/**
 * SCORM API Dispatcher for iSpring 11 Compatible Runtime
 * Creates and manages SCORM 1.2 and 2004 API instances
 */

import { Scorm12API } from './api-12';
import { Scorm2004API } from './api-2004';
import { ScormPersistence } from './persist';

export interface ScormApiConfig {
  attemptId: string;
  assignmentId: string;
  userId: string;
  courseId: string;
  organisationId: string;
  itemId?: string;
  standard: '1.2' | '2004';
  learnerId: string;
  learnerName: string;
}

export interface ScormApis {
  API?: Scorm12API;
  API_1484_11?: Scorm2004API;
}

export class ScormApiDispatcher {
  private persistence: ScormPersistence;
  private apis: Map<string, ScormApis> = new Map();

  constructor() {
    this.persistence = new ScormPersistence();
  }

  /**
   * Create SCORM APIs for a specific attempt
   */
  async createApis(config: ScormApiConfig): Promise<ScormApis> {
    console.log(`🎯 Creating SCORM ${config.standard} APIs for attempt: ${config.attemptId}`);

    // Get or create attempt in database
    const attemptData = {
      attemptId: config.attemptId,
      assignmentId: config.assignmentId,
      userId: config.userId,
      courseId: config.courseId,
      organisationId: config.organisationId,
      itemId: config.itemId,
      standard: config.standard,
    };

    const attempt = await this.persistence.getOrCreateAttempt(attemptData);
    
    // Prepare initial data for resume functionality
    const initialData: Record<string, string> = {};
    
    if (config.standard === '1.2') {
      // Map database fields to SCORM 1.2 data model
      if (attempt.lessonStatus) initialData['cmi.core.lesson_status'] = attempt.lessonStatus;
      if (attempt.lessonLocation) initialData['cmi.core.lesson_location'] = attempt.lessonLocation;
      if (attempt.scoreRaw) initialData['cmi.core.score.raw'] = attempt.scoreRaw.toString();
      if (attempt.scoreMin) initialData['cmi.core.score.min'] = attempt.scoreMin.toString();
      if (attempt.scoreMax) initialData['cmi.core.score.max'] = attempt.scoreMax.toString();
      if (attempt.sessionTime) initialData['cmi.core.session_time'] = attempt.sessionTime;
      if (attempt.suspendData) initialData['cmi.suspend_data'] = attempt.suspendData;
      
      // Set learner information
      initialData['cmi.core.student_id'] = config.learnerId;
      initialData['cmi.core.student_name'] = config.learnerName;
    } else {
      // Map database fields to SCORM 2004 data model
      if (attempt.completionStatus) initialData['cmi.completion_status'] = attempt.completionStatus;
      if (attempt.successStatus) initialData['cmi.success_status'] = attempt.successStatus;
      if (attempt.location) initialData['cmi.location'] = attempt.location;
      if (attempt.progressMeasure) initialData['cmi.progress_measure'] = attempt.progressMeasure.toString();
      if (attempt.scoreRaw) initialData['cmi.score.raw'] = attempt.scoreRaw.toString();
      if (attempt.scoreScaled) initialData['cmi.score.scaled'] = attempt.scoreScaled.toString();
      if (attempt.scoreMin) initialData['cmi.score.min'] = attempt.scoreMin.toString();
      if (attempt.scoreMax) initialData['cmi.score.max'] = attempt.scoreMax.toString();
      if (attempt.sessionTime) initialData['cmi.session_time'] = attempt.sessionTime;
      if (attempt.suspendData) initialData['cmi.suspend_data'] = attempt.suspendData;
      
      // Set learner information
      initialData['cmi.learner_id'] = config.learnerId;
      initialData['cmi.learner_name'] = config.learnerName;
    }

    // Create commit callback
    const onCommit = async (data: Record<string, string>) => {
      console.log(`💾 API Commit callback for attempt: ${config.attemptId}`);
      await this.persistence.persistRuntime(config.attemptId, data);
    };

    // Create terminate callback
    const onTerminate = async () => {
      console.log(`🏁 API Terminate callback for attempt: ${config.attemptId}`);
      await this.persistence.terminateAttempt(config.attemptId);
    };

    const apis: ScormApis = {};

    if (config.standard === '1.2') {
      apis.API = new Scorm12API(
        config.attemptId,
        onCommit,
        onTerminate,
        initialData
      );
      console.log(`✅ SCORM 1.2 API created for attempt: ${config.attemptId}`);
    } else {
      apis.API_1484_11 = new Scorm2004API(
        config.attemptId,
        onCommit,
        onTerminate,
        initialData
      );
      console.log(`✅ SCORM 2004 API created for attempt: ${config.attemptId}`);
    }

    // Store APIs for cleanup
    this.apis.set(config.attemptId, apis);
    
    return apis;
  }

  /**
   * Get existing APIs for an attempt
   */
  getApis(attemptId: string): ScormApis | undefined {
    return this.apis.get(attemptId);
  }

  /**
   * Clean up APIs for an attempt
   */
  cleanupApis(attemptId: string): void {
    console.log(`🧹 Cleaning up APIs for attempt: ${attemptId}`);
    this.apis.delete(attemptId);
  }

  /**
   * Get attempt state for client-side initialization
   */
  async getAttemptState(attemptId: string): Promise<any> {
    return await this.persistence.getAttemptState(attemptId);
  }

  /**
   * Create APIs for browser window exposure
   */
  static makeScormApis(config: ScormApiConfig): Promise<ScormApis> {
    const dispatcher = new ScormApiDispatcher();
    return dispatcher.createApis(config);
  }
}

// Types and class are already exported above