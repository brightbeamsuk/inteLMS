/**
 * SCORM Persistence Layer for iSpring 11 Compatible Runtime
 * Handles all database operations for SCORM attempts with proper completion logic
 */

import { db } from "../db";
import { scormAttempts } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface ScormAttemptData {
  attemptId: string;
  assignmentId: string;
  userId: string;
  courseId: string;
  organisationId: string;
  itemId?: string;
  standard: '1.2' | '2004';
}

export interface ScormDataPairs {
  [key: string]: string;
}

export class ScormPersistence {
  /**
   * Create a new SCORM attempt
   */
  async createAttempt(data: ScormAttemptData): Promise<void> {
    console.log(`📝 Creating new SCORM attempt: ${data.attemptId}`);
    
    await db.insert(scormAttempts).values({
      attemptId: data.attemptId,
      assignmentId: data.assignmentId,
      userId: data.userId,
      courseId: data.courseId,
      organisationId: data.organisationId,
      itemId: data.itemId,
      standard: data.standard,
      status: 'not_started',
      
      // Initialize with proper defaults based on SCORM version
      ...(data.standard === '1.2' ? {
        lessonStatus: 'not attempted',
      } : {
        completionStatus: 'not attempted',
        successStatus: 'unknown',
      }),
      
      isActive: true,
      progressPercent: 0,
      passed: false,
      completed: false,
    });
    
    console.log(`✅ SCORM attempt created: ${data.attemptId}`);
  }

  /**
   * Get existing attempt or create new one
   */
  async getOrCreateAttempt(data: ScormAttemptData): Promise<any> {
    console.log(`🔍 Looking for existing attempt: ${data.assignmentId} for user ${data.userId}`);
    
    // Look for active attempt first
    const existingAttempt = await db
      .select()
      .from(scormAttempts)
      .where(
        and(
          eq(scormAttempts.assignmentId, data.assignmentId),
          eq(scormAttempts.userId, data.userId),
          eq(scormAttempts.isActive, true)
        )
      )
      .limit(1);

    if (existingAttempt.length > 0) {
      console.log(`🔄 Resuming existing attempt: ${existingAttempt[0].attemptId}`);
      return existingAttempt[0];
    }

    // Create new attempt
    await this.createAttempt(data);
    
    // Return the new attempt
    const newAttempt = await db
      .select()
      .from(scormAttempts)
      .where(eq(scormAttempts.attemptId, data.attemptId))
      .limit(1);
    
    return newAttempt[0];
  }

  /**
   * Persist runtime data with completion logic
   */
  async persistRuntime(attemptId: string, pairs: ScormDataPairs): Promise<void> {
    console.log(`💾 Persisting SCORM data for attempt: ${attemptId}`);
    console.log(`📊 Data pairs count: ${Object.keys(pairs).length}`);
    
    // Get current attempt
    const attempt = await db
      .select()
      .from(scormAttempts)
      .where(eq(scormAttempts.attemptId, attemptId))
      .limit(1);
    
    if (!attempt.length) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }
    
    const currentAttempt = attempt[0];
    const standard = currentAttempt.standard;
    
    // Prepare update data
    const updateData: any = {
      lastCommitAt: new Date(),
      rawScormData: pairs,
      updatedAt: new Date(),
    };
    
    // Map SCORM fields based on version
    if (standard === '1.2') {
      this.mapScorm12Fields(pairs, updateData);
    } else {
      this.mapScorm2004Fields(pairs, updateData);
    }
    
    // Calculate completion status
    this.calculateCompletion(standard, updateData, currentAttempt);
    
    // Handle status lifecycle management
    this.updateStatusLifecycle(updateData, currentAttempt);
    
    // Update the attempt
    await db
      .update(scormAttempts)
      .set(updateData)
      .where(eq(scormAttempts.attemptId, attemptId));
    
    console.log(`✅ SCORM data persisted for attempt: ${attemptId}`);
    console.log(`📈 Completion status: ${updateData.completed}, Progress: ${updateData.progressPercent}%`);
  }

  /**
   * Map SCORM 1.2 fields to database columns
   */
  private mapScorm12Fields(pairs: ScormDataPairs, updateData: any): void {
    // Status mapping
    if (pairs['cmi.core.lesson_status']) {
      updateData.lessonStatus = pairs['cmi.core.lesson_status'];
    }
    
    // Location (bookmark)
    if (pairs['cmi.core.lesson_location']) {
      updateData.lessonLocation = pairs['cmi.core.lesson_location'];
    }
    
    // Score mapping
    if (pairs['cmi.core.score.raw']) {
      updateData.scoreRaw = parseFloat(pairs['cmi.core.score.raw']) || null;
    }
    if (pairs['cmi.core.score.min']) {
      updateData.scoreMin = parseFloat(pairs['cmi.core.score.min']) || null;
    }
    if (pairs['cmi.core.score.max']) {
      updateData.scoreMax = parseFloat(pairs['cmi.core.score.max']) || null;
    }
    
    // Session time
    if (pairs['cmi.core.session_time']) {
      updateData.sessionTime = pairs['cmi.core.session_time'];
    }
    
    // Suspend data (critical for resume)
    if (pairs['cmi.suspend_data']) {
      updateData.suspendData = pairs['cmi.suspend_data'];
    }
  }

  /**
   * Map SCORM 2004 fields to database columns
   */
  private mapScorm2004Fields(pairs: ScormDataPairs, updateData: any): void {
    // Status mapping
    if (pairs['cmi.completion_status']) {
      updateData.completionStatus = pairs['cmi.completion_status'];
    }
    if (pairs['cmi.success_status']) {
      updateData.successStatus = pairs['cmi.success_status'];
    }
    
    // Location (bookmark)
    if (pairs['cmi.location']) {
      updateData.location = pairs['cmi.location'];
    }
    
    // Progress measure (0-1 scale)
    if (pairs['cmi.progress_measure']) {
      const progressMeasure = parseFloat(pairs['cmi.progress_measure']);
      if (!isNaN(progressMeasure) && progressMeasure >= 0 && progressMeasure <= 1) {
        updateData.progressMeasure = progressMeasure;
      }
    }
    
    // Score mapping
    if (pairs['cmi.score.raw']) {
      updateData.scoreRaw = parseFloat(pairs['cmi.score.raw']) || null;
    }
    if (pairs['cmi.score.scaled']) {
      updateData.scoreScaled = parseFloat(pairs['cmi.score.scaled']) || null;
    }
    if (pairs['cmi.score.min']) {
      updateData.scoreMin = parseFloat(pairs['cmi.score.min']) || null;
    }
    if (pairs['cmi.score.max']) {
      updateData.scoreMax = parseFloat(pairs['cmi.score.max']) || null;
    }
    
    // Session time
    if (pairs['cmi.session_time']) {
      updateData.sessionTime = pairs['cmi.session_time'];
    }
    
    // Suspend data (critical for resume)
    if (pairs['cmi.suspend_data']) {
      updateData.suspendData = pairs['cmi.suspend_data'];
    }
  }

  /**
   * Calculate completion status based on iSpring 11 compatible logic
   */
  private calculateCompletion(standard: string, updateData: any, currentAttempt: any): void {
    let completed = false;
    let passed = false;
    let progressPercent = currentAttempt.progressPercent || 0;
    
    if (standard === '1.2') {
      // SCORM 1.2: Mark complete when lesson_status is "completed" or "passed"
      const lessonStatus = updateData.lessonStatus || currentAttempt.lessonStatus;
      
      if (lessonStatus === 'completed' || lessonStatus === 'passed') {
        completed = true;
        progressPercent = 100;
        
        if (lessonStatus === 'passed') {
          passed = true;
        }
      } else if (lessonStatus === 'failed') {
        completed = true;
        progressPercent = 100;
        passed = false;
      } else if (lessonStatus === 'incomplete') {
        // For incomplete status, try to derive progress from suspend_data or location
        const suspendData = updateData.suspendData || currentAttempt.suspendData;
        if (suspendData && suspendData.length > 0) {
          // Basic heuristic: more suspend data = more progress (fallback only)
          progressPercent = Math.min(Math.floor((suspendData.length / 1000) * 50), 75);
        }
      }
    } else {
      // SCORM 2004: More sophisticated completion logic
      const completionStatus = updateData.completionStatus || currentAttempt.completionStatus;
      const successStatus = updateData.successStatus || currentAttempt.successStatus;
      const progressMeasure = updateData.progressMeasure ?? currentAttempt.progressMeasure;
      
      // Use progress_measure if available (primary method for iSpring 11)
      if (progressMeasure !== null && progressMeasure !== undefined) {
        progressPercent = Math.round(progressMeasure * 100);
      }
      
      // Mark complete when completion_status = "completed" OR success_status = "passed"
      if (completionStatus === 'completed' || successStatus === 'passed') {
        completed = true;
        progressPercent = 100;
        
        if (successStatus === 'passed') {
          passed = true;
        }
      } else if (successStatus === 'failed') {
        completed = true;
        passed = false;
        // Keep current progress, don't force to 100% for failures
      }
    }
    
    // Update the calculated fields
    updateData.completed = completed;
    updateData.passed = passed;
    updateData.progressPercent = progressPercent;
    
    // If completed, set finished timestamp
    if (completed && !currentAttempt.finishedAt) {
      updateData.finishedAt = new Date();
    }
  }

  /**
   * Terminate an attempt (called on Finish/Terminate)
   */
  async terminateAttempt(attemptId: string): Promise<void> {
    console.log(`🏁 Terminating SCORM attempt: ${attemptId}`);
    
    await db
      .update(scormAttempts)
      .set({
        isActive: false,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scormAttempts.attemptId, attemptId));
    
    console.log(`✅ SCORM attempt terminated: ${attemptId}`);
  }

  /**
   * Get attempt state for resume
   */
  async getAttemptState(attemptId: string): Promise<any> {
    const attempt = await db
      .select()
      .from(scormAttempts)
      .where(eq(scormAttempts.attemptId, attemptId))
      .limit(1);
    
    if (!attempt.length) {
      throw new Error(`Attempt not found: ${attemptId}`);
    }
    
    return attempt[0];
  }

  /**
   * Handle SCORM attempt status lifecycle management
   * Not Started → In Progress → Completed
   */
  private updateStatusLifecycle(updateData: any, currentAttempt: any): void {
    const currentStatus = currentAttempt.status || 'not_started';
    
    // Default to In Progress if not complete
    updateData.status = 'in_progress';
    
    // Check if we're completing the attempt
    const completed = updateData.completed ?? currentAttempt.completed ?? false;
    
    if (completed) {
      // Mark as completed when completion conditions are met
      updateData.status = 'completed';
      updateData.isActive = false;
      
      // Set terminated timestamp if not already set
      if (!currentAttempt.finishedAt && !updateData.finishedAt) {
        updateData.finishedAt = new Date();
      }
    } else {
      // Keep active and in progress for ongoing attempts
      updateData.isActive = true;
    }
    
    console.log(`📊 Status lifecycle: ${currentStatus} → ${updateData.status} (Completed: ${completed})`);
  }
}