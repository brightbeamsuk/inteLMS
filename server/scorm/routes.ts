/**
 * SCORM Runtime Routes for iSpring 11 Compatible Implementation
 * Provides the new endpoint structure specified in the requirements
 */

import { Router } from 'express';
import { ScormApiDispatcher } from './api-dispatch';
import { ScormPersistence } from './persist';

const router = Router();
const scormPersistence = new ScormPersistence();
const scormApiDispatcher = new ScormApiDispatcher();

/**
 * POST /scorm/runtime/:attemptId/commit
 * Internal endpoint for persisting SCORM data atomically
 */
router.post('/runtime/:attemptId/commit', async (req, res) => {
  try {
    const { attemptId } = req.params;
    const pairs = req.body;

    console.log(`💾 SCORM Runtime Commit for attempt: ${attemptId}`);
    console.log(`📊 Data pairs:`, Object.keys(pairs));

    if (!pairs || typeof pairs !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid data pairs format' 
      });
    }

    // Persist the data atomically
    await scormPersistence.persistRuntime(attemptId, pairs);

    res.json({ 
      success: true,
      message: `Data committed for attempt ${attemptId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ SCORM Runtime commit error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * POST /scorm/log
 * Debug logging endpoint for SCORM API calls
 */
router.post('/log', async (req, res) => {
  try {
    const { attemptId, method, args, result, timestamp, standard } = req.body;

    // Log to console in development
    if (process.env.SCORM_DEBUG === 'true') {
      console.log(`🔧 SCORM ${standard} ${method}(${args?.join?.(', ') || args}) => ${result} (Attempt: ${attemptId})`);
    }

    // Store in database for diagnostics (optional - could be implemented later)
    // For now, just acknowledge the log
    res.json({ 
      success: true,
      logged: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ SCORM log error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /scorm/attempt/:attemptId
 * Return current attempt state for UI progress updates
 */
router.get('/attempt/:attemptId', async (req, res) => {
  try {
    const { attemptId } = req.params;

    console.log(`📊 Getting attempt state for: ${attemptId}`);

    const attemptState = await scormApiDispatcher.getAttemptState(attemptId);
    
    if (!attemptState) {
      return res.status(404).json({ 
        success: false, 
        error: 'Attempt not found' 
      });
    }

    // Return progress information
    const response = {
      success: true,
      attemptId: attemptState.attemptId,
      standard: attemptState.standard,
      status: attemptState.status,
      progressPercent: attemptState.progressPercent || 0,
      completed: attemptState.completed || false,
      passed: attemptState.passed || false,
      
      // SCORM-specific status fields
      ...(attemptState.standard === '1.2' ? {
        lessonStatus: attemptState.lessonStatus,
        lessonLocation: attemptState.lessonLocation,
      } : {
        completionStatus: attemptState.completionStatus,
        successStatus: attemptState.successStatus,
        location: attemptState.location,
        progressMeasure: attemptState.progressMeasure,
      }),
      
      // Score information
      scoreRaw: attemptState.scoreRaw,
      scoreScaled: attemptState.scoreScaled,
      scoreMin: attemptState.scoreMin,
      scoreMax: attemptState.scoreMax,
      
      // Timestamps
      createdAt: attemptState.createdAt,
      updatedAt: attemptState.updatedAt,
      lastCommitAt: attemptState.lastCommitAt,
      finishedAt: attemptState.finishedAt,
    };

    console.log(`✅ Attempt state retrieved: Progress ${response.progressPercent}%, Completed: ${response.completed}`);
    res.json(response);

  } catch (error) {
    console.error(`❌ Get attempt state error:`, error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export { router as scormRoutes };