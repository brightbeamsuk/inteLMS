/**
 * Comprehensive SCORM API Implementation 
 * Supports SCORM 1.2 and SCORM 2004 standards
 * Implements all requirements for API discovery, data persistence, completion logic, and progress tracking
 */

class ScormAPI {
  constructor(assignmentId, learnerId, learnerName, onDataChange) {
    this.assignmentId = assignmentId;
    this.learnerId = learnerId;
    this.learnerName = learnerName;
    this.onDataChange = onDataChange;
    this.attemptId = null;
    this.isInitialized = false;
    this.isTerminated = false;
    this.lastError = '0';
    this.errorStrings = this.getErrorStrings();
    this.commitRetries = 0;
    this.maxRetries = 3;
    this.discardMode = false; // NEW: Flag to prevent commits when discarding
    this.exitHandlers = []; // NEW: Track exit handlers for cleanup
    
    // SCORM data store with proper defaults
    this.data = {
      // SCORM 1.2 Data Model
      'cmi.core.lesson_status': 'not attempted',
      'cmi.core.score.raw': '',
      'cmi.core.score.min': '0', 
      'cmi.core.score.max': '100',
      'cmi.core.lesson_location': '',
      'cmi.core.session_time': '00:00:00',
      'cmi.core.student_id': learnerId,
      'cmi.core.student_name': learnerName,
      'cmi.core.exit': '',
      'cmi.suspend_data': '',
      
      // SCORM 2004 Data Model
      'cmi.completion_status': 'not attempted', 
      'cmi.success_status': 'unknown',
      'cmi.score.raw': '',
      'cmi.score.scaled': '',
      'cmi.score.min': '0',
      'cmi.score.max': '100', 
      'cmi.location': '',
      'cmi.session_time': 'PT0H0M0S',
      'cmi.learner_id': learnerId,
      'cmi.learner_name': learnerName,
      'cmi.exit': '',
      'cmi.suspend_data': '',
      'cmi.progress_measure': ''
    };

    // Session tracking
    this.sessionStartTime = new Date();
    this.totalSessionTime = 0;
    
    // Bind methods to preserve context
    this.LMSInitialize = this.LMSInitialize.bind(this);
    this.LMSFinish = this.LMSFinish.bind(this);
    this.LMSGetValue = this.LMSGetValue.bind(this);
    this.LMSSetValue = this.LMSSetValue.bind(this);
    this.LMSCommit = this.LMSCommit.bind(this);
    this.LMSGetLastError = this.LMSGetLastError.bind(this);
    this.LMSGetErrorString = this.LMSGetErrorString.bind(this);
    this.LMSGetDiagnostic = this.LMSGetDiagnostic.bind(this);
    
    // SCORM 2004 method bindings
    this.Initialize = this.Initialize.bind(this);
    this.Terminate = this.Terminate.bind(this);
    this.GetValue = this.GetValue.bind(this);
    this.SetValue = this.SetValue.bind(this);
    this.Commit = this.Commit.bind(this);
    this.GetLastError = this.GetLastError.bind(this);
    this.GetErrorString = this.GetErrorString.bind(this);
    this.GetDiagnostic = this.GetDiagnostic.bind(this);

    console.log('🎯 SCORM API initialized for learner:', learnerId, 'assignment:', assignmentId);
  }

  // ==================== SCORM 1.2 API Methods ====================
  
  LMSInitialize(parameter) {
    console.log('📡 LMSInitialize called with:', parameter);
    
    if (this.isInitialized) {
      console.warn('⚠️ Already initialized');
      this.setError('101'); // Already initialized
      return 'false';
    }
    
    if (this.isTerminated) {
      console.warn('⚠️ Already terminated');
      this.setError('104'); // Content instance terminated
      return 'false';
    }

    this.isInitialized = true;
    this.isTerminated = false;
    this.attemptId = this.generateAttemptId();
    this.sessionStartTime = new Date();
    this.setError('0'); // No error
    
    // Auto-set lesson status to incomplete if not attempted
    if (this.data['cmi.core.lesson_status'] === 'not attempted') {
      this.data['cmi.core.lesson_status'] = 'incomplete';
      console.log('🔄 Auto-set lesson_status to incomplete');
    }

    console.log('✅ SCORM 1.2 initialized with attemptId:', this.attemptId);
    return 'true';
  }

  LMSFinish(parameter) {
    console.log('🏁 LMSFinish called with:', parameter);
    
    if (!this.isInitialized) {
      console.warn('⚠️ Not initialized');
      this.setError('112'); // Content instance not initialized
      return 'false';
    }

    if (this.isTerminated) {
      console.warn('⚠️ Already terminated');
      this.setError('113'); // Content instance already terminated
      return 'false';
    }

    // Update session time before finishing
    this.updateSessionTime('1.2');
    
    // Set exit mode if not already set
    if (!this.data['cmi.core.exit']) {
      const lessonStatus = this.data['cmi.core.lesson_status'];
      if (lessonStatus === 'completed' || lessonStatus === 'passed') {
        this.data['cmi.core.exit'] = 'logout';
      } else {
        this.data['cmi.core.exit'] = 'suspend';
      }
    }

    // Final commit (skip if discarding)
    if (!this.discardMode) {
      this.LMSCommit('');
    } else {
      console.log('🗑️ DISCARD MODE: Skipping final LMSCommit in LMSFinish');
    }
    
    this.isTerminated = true;
    this.isInitialized = false;
    this.setError('0');
    
    console.log('✅ SCORM 1.2 terminated');
    return 'true';
  }

  LMSGetValue(element) {
    console.log('📊 LMSGetValue:', element);
    
    if (!this.isInitialized) {
      this.setError('112');
      return '';
    }

    if (this.data.hasOwnProperty(element)) {
      const value = this.data[element] || '';
      console.log('📤 LMSGetValue result:', element, '=', value);
      this.setError('0');
      return value;
    }

    console.warn('⚠️ Invalid data model element:', element);
    this.setError('401'); // Invalid data model element reference
    return '';
  }

  LMSSetValue(element, value) {
    console.log('📊 LMSSetValue:', element, '=', value);
    
    if (!this.isInitialized) {
      this.setError('112');
      return 'false';
    }

    if (!this.data.hasOwnProperty(element)) {
      console.warn('⚠️ Invalid data model element:', element);
      this.setError('401');
      return 'false';
    }

    // Store the value
    this.data[element] = String(value);
    this.setError('0');
    
    // Trigger progress calculation on status changes
    if (element === 'cmi.core.lesson_status') {
      this.calculateAndReportProgress('1.2');
    }

    console.log('✅ LMSSetValue success:', element, '=', value);
    return 'true';
  }

  LMSCommit(parameter) {
    console.log('💾 LMSCommit called');
    
    if (!this.isInitialized) {
      this.setError('112');
      return 'false';
    }

    // DISCARD MODE: Skip commit but return success
    if (this.discardMode) {
      console.log('🗑️ DISCARD MODE: Skipping LMSCommit');
      this.setError('0');
      return 'true';
    }

    return this.commitWithRetry('1.2', 'commit');
  }

  LMSGetLastError() {
    return this.lastError;
  }

  LMSGetErrorString(errorCode) {
    return this.errorStrings['1.2'][errorCode] || 'Unknown error';
  }

  LMSGetDiagnostic(errorCode) {
    return this.LMSGetErrorString(errorCode);
  }

  // ==================== SCORM 2004 API Methods ====================

  Initialize(parameter) {
    console.log('📡 Initialize called with:', parameter);
    
    if (this.isInitialized) {
      this.setError('103'); // Already initialized
      return 'false';
    }

    this.isInitialized = true;
    this.isTerminated = false;
    this.attemptId = this.generateAttemptId();
    this.sessionStartTime = new Date();
    this.setError('0');
    
    // Auto-set completion status to incomplete if not attempted
    if (this.data['cmi.completion_status'] === 'not attempted') {
      this.data['cmi.completion_status'] = 'incomplete';
      console.log('🔄 Auto-set completion_status to incomplete');
    }

    console.log('✅ SCORM 2004 initialized with attemptId:', this.attemptId);
    return 'true';
  }

  Terminate(parameter) {
    console.log('🏁 Terminate called with:', parameter);
    
    if (!this.isInitialized) {
      this.setError('142'); // Termination before initialization
      return 'false';
    }

    if (this.isTerminated) {
      this.setError('143'); // Termination after termination
      return 'false';
    }

    // Update session time before terminating
    this.updateSessionTime('2004');
    
    // Set exit mode if not set
    if (!this.data['cmi.exit']) {
      const completionStatus = this.data['cmi.completion_status'];
      const successStatus = this.data['cmi.success_status'];
      
      if (completionStatus === 'completed' || successStatus === 'passed') {
        this.data['cmi.exit'] = 'normal';
      } else {
        this.data['cmi.exit'] = 'suspend';
      }
    }

    // Final commit (skip if discarding)
    if (!this.discardMode) {
      this.Commit('');
    } else {
      console.log('🗑️ DISCARD MODE: Skipping final Commit in Terminate');
    }
    
    this.isTerminated = true;
    this.isInitialized = false;
    this.setError('0');
    
    console.log('✅ SCORM 2004 terminated');
    return 'true';
  }

  GetValue(element) {
    console.log('📊 GetValue:', element);
    
    if (!this.isInitialized) {
      this.setError('122'); // Retrieve data before initialization
      return '';
    }

    if (this.data.hasOwnProperty(element)) {
      const value = this.data[element] || '';
      console.log('📤 GetValue result:', element, '=', value);
      this.setError('0');
      return value;
    }

    console.warn('⚠️ Invalid data model element:', element);
    this.setError('401');
    return '';
  }

  SetValue(element, value) {
    console.log('📊 SetValue:', element, '=', value);
    
    if (!this.isInitialized) {
      this.setError('132'); // Store data before initialization
      return 'false';
    }

    if (!this.data.hasOwnProperty(element)) {
      console.warn('⚠️ Invalid data model element:', element);
      this.setError('401');
      return 'false';
    }

    this.data[element] = String(value);
    this.setError('0');
    
    // Trigger progress calculation on status changes
    if (element === 'cmi.completion_status' || element === 'cmi.success_status' || element === 'cmi.progress_measure') {
      this.calculateAndReportProgress('2004');
    }

    console.log('✅ SetValue success:', element, '=', value);
    return 'true';
  }

  Commit(parameter) {
    console.log('💾 Commit called');
    
    if (!this.isInitialized) {
      this.setError('142');
      return 'false';
    }

    // DISCARD MODE: Skip commit but return success
    if (this.discardMode) {
      console.log('🗑️ DISCARD MODE: Skipping Commit');
      this.setError('0');
      return 'true';
    }

    return this.commitWithRetry('2004', 'commit');
  }

  GetLastError() {
    return this.lastError;
  }

  GetErrorString(errorCode) {
    return this.errorStrings['2004'][errorCode] || 'Unknown error';
  }

  GetDiagnostic(errorCode) {
    return this.GetErrorString(errorCode);
  }

  // ==================== Helper Methods ====================

  generateAttemptId() {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setError(code) {
    this.lastError = code;
    console.log('🔢 Error code set:', code);
  }

  updateSessionTime(standard) {
    const now = new Date();
    const sessionSeconds = Math.floor((now.getTime() - this.sessionStartTime.getTime()) / 1000);
    this.totalSessionTime += sessionSeconds;
    
    if (standard === '1.2') {
      // SCORM 1.2 format: HH:MM:SS
      const hours = Math.floor(this.totalSessionTime / 3600);
      const minutes = Math.floor((this.totalSessionTime % 3600) / 60);
      const seconds = this.totalSessionTime % 60;
      this.data['cmi.core.session_time'] = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // SCORM 2004 format: PT[n]H[n]M[n]S
      const hours = Math.floor(this.totalSessionTime / 3600);
      const minutes = Math.floor((this.totalSessionTime % 3600) / 60);
      const seconds = this.totalSessionTime % 60;
      this.data['cmi.session_time'] = `PT${hours}H${minutes}M${seconds}S`;
    }
    
    // Reset session start time for next interval
    this.sessionStartTime = now;
  }

  calculateAndReportProgress(standard) {
    let progressPercent = 0;
    let isComplete = false;
    let isPassed = false;

    if (standard === '1.2') {
      const lessonStatus = this.data['cmi.core.lesson_status'];
      
      // Completion logic: completed OR passed means course complete
      if (lessonStatus === 'completed' || lessonStatus === 'passed') {
        isComplete = true;
        progressPercent = 100;
        isPassed = (lessonStatus === 'passed');
      } else if (lessonStatus === 'failed') {
        isComplete = true;
        progressPercent = 100;
        isPassed = false;
      } else if (lessonStatus === 'incomplete') {
        // Try to extract progress from suspend data
        progressPercent = this.extractProgressFromSuspendData();
        if (progressPercent === 0) {
          // Fallback based on interaction
          progressPercent = this.data['cmi.suspend_data'] ? 60 : 25;
        }
      } else {
        progressPercent = 0; // not attempted
      }
    } else {
      // SCORM 2004
      const completionStatus = this.data['cmi.completion_status'];
      const successStatus = this.data['cmi.success_status'];
      const progressMeasure = parseFloat(this.data['cmi.progress_measure'] || '0');

      // Completion logic: completion_status=completed OR success_status=passed
      if (completionStatus === 'completed' || successStatus === 'passed') {
        isComplete = true;
        progressPercent = 100;
        isPassed = (successStatus === 'passed');
      } else if (successStatus === 'failed') {
        isComplete = true;
        progressPercent = 100;
        isPassed = false;
      } else if (progressMeasure > 0) {
        progressPercent = Math.round(progressMeasure * 100);
      } else if (completionStatus === 'incomplete') {
        progressPercent = this.extractProgressFromSuspendData();
        if (progressPercent === 0) {
          progressPercent = this.data['cmi.suspend_data'] ? 60 : 25;
        }
      } else {
        progressPercent = 0; // not attempted or unknown
      }
    }

    // Report progress to parent component
    if (this.onDataChange) {
      this.onDataChange({
        progressPercent,
        isComplete,
        isPassed,
        standard
      });
    }

    console.log(`📊 Progress calculated: ${progressPercent}%, Complete: ${isComplete}, Passed: ${isPassed}`);
  }

  extractProgressFromSuspendData() {
    const suspendData = this.data['cmi.suspend_data'];
    if (!suspendData) return 0;

    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(suspendData);
      if (parsed.progress) return Math.min(95, parseInt(parsed.progress));
      if (parsed.percentage) return Math.min(95, parseInt(parsed.percentage));
    } catch {
      // Try regex patterns
      const percentMatch = suspendData.match(/(\d+)%/);
      if (percentMatch) return Math.min(95, parseInt(percentMatch[1]));
      
      const progressMatch = suspendData.match(/progress[:\s]*(\d+)/i);
      if (progressMatch) return Math.min(95, parseInt(progressMatch[1]));
    }

    return 0;
  }

  async commitWithRetry(standard, reason) {
    // DISCARD MODE: Skip all commits
    if (this.discardMode) {
      console.log('🗑️ DISCARD MODE: Skipping commitWithRetry');
      this.setError('0');
      return 'true';
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Update session time before commit
        this.updateSessionTime(standard);
        
        const success = await this.sendDataToServer(standard, reason);
        if (success) {
          this.commitRetries = 0;
          this.setError('0');
          return 'true';
        }
        
        if (attempt < this.maxRetries) {
          // Exponential backoff: 500ms, 1s, 2s
          const delay = 500 * Math.pow(2, attempt);
          console.log(`⏱️ Commit retry ${attempt + 1}/${this.maxRetries} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error('💥 Commit error:', error);
        if (attempt === this.maxRetries) {
          this.setError('391'); // General commit failure
          return 'false';
        }
      }
    }
    
    this.setError('391');
    return 'false';
  }

  async sendDataToServer(standard, reason) {
    if (!this.onDataChange) return false;
    
    const payload = {
      learnerId: this.learnerId,
      courseId: this.assignmentId,
      attemptId: this.attemptId,
      standard,
      reason,
      scormData: this.getScormDataForStandard(standard)
    };

    try {
      const response = await fetch('/api/scorm/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Data sent to server:', result);
        
        // Update progress based on server response
        if (result.derivedFields && result.derivedFields.progressPercent !== undefined) {
          if (this.onDataChange) {
            this.onDataChange({
              progressPercent: result.derivedFields.progressPercent,
              isComplete: result.derivedFields.completed,
              isPassed: result.derivedFields.passed,
              standard
            });
          }
        }
        
        return true;
      } else {
        console.error('❌ Server error:', response.status);
        return false;
      }
    } catch (error) {
      console.error('💥 Network error:', error);
      return false;
    }
  }

  getScormDataForStandard(standard) {
    if (standard === '1.2') {
      return {
        'cmi.core.lesson_status': this.data['cmi.core.lesson_status'],
        'cmi.core.score.raw': this.data['cmi.core.score.raw'],
        'cmi.core.score.min': this.data['cmi.core.score.min'],
        'cmi.core.score.max': this.data['cmi.core.score.max'],
        'cmi.core.lesson_location': this.data['cmi.core.lesson_location'],
        'cmi.suspend_data': this.data['cmi.suspend_data'],
        'cmi.core.session_time': this.data['cmi.core.session_time']
      };
    } else {
      return {
        'cmi.completion_status': this.data['cmi.completion_status'],
        'cmi.success_status': this.data['cmi.success_status'],
        'cmi.score.raw': this.data['cmi.score.raw'],
        'cmi.score.scaled': this.data['cmi.score.scaled'],
        'cmi.progress_measure': this.data['cmi.progress_measure'],
        'cmi.location': this.data['cmi.location'],
        'cmi.suspend_data': this.data['cmi.suspend_data'],
        'cmi.session_time': this.data['cmi.session_time']
      };
    }
  }

  getErrorStrings() {
    return {
      '1.2': {
        '0': 'No error',
        '101': 'General exception',
        '102': 'Server busy',
        '103': 'Invalid argument error',
        '104': 'Element cannot have children',
        '105': 'Element not an array',
        '201': 'Invalid argument error',
        '202': 'Element cannot have children',
        '203': 'Element not an array',
        '301': 'Not initialized',
        '401': 'Not implemented error',
        '402': 'Invalid set value, element is a keyword',
        '403': 'Element is read only',
        '404': 'Element is write only',
        '405': 'Incorrect data type'
      },
      '2004': {
        '0': 'No error',
        '101': 'General exception',
        '102': 'General initialization failure',
        '103': 'Already initialized',
        '104': 'Content instance terminated',
        '111': 'General termination failure',
        '112': 'Termination before initialization',
        '113': 'Termination after termination',
        '122': 'Retrieve data before initialization',
        '123': 'Retrieve data after termination',
        '132': 'Store data before initialization',
        '133': 'Store data after termination',
        '142': 'Commit before initialization',
        '143': 'Commit after termination',
        '391': 'General commit failure',
        '401': 'Undefined data model element',
        '402': 'Unimplemented data model element',
        '403': 'Data model element value not initialized',
        '404': 'Data model element is read only',
        '405': 'Data model element is write only'
      }
    };
  }

  // Setup beforeunload handler for commit & exit safety
  setupExitHandler() {
    const handleBeforeUnload = () => {
      if (this.isInitialized && !this.isTerminated && !this.discardMode) {
        console.log('🚪 Page unloading - auto-commit and terminate');
        if (this.data['cmi.core.lesson_status'] || this.data['cmi.completion_status']) {
          this.commitWithRetry(
            (this.data['cmi.completion_status'] !== undefined || this.data['cmi.success_status'] !== undefined) ? '2004' : '1.2', 
            'finish'
          );
        }
      } else if (this.discardMode) {
        console.log('🗑️ DISCARD MODE: Skipping auto-save on page unload');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    
    // Store handlers for removal during discard
    this.exitHandlers = [handleBeforeUnload];
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }

  // NEW: Remove auto-save handlers when discarding
  removeAutoSaveHandlers() {
    console.log('🗑️ Removing auto-save handlers for discard');
    this.exitHandlers.forEach(handler => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    });
    this.exitHandlers = [];
  }

  // NEW: Discard and exit method
  async discardAndExit({ assignmentId, attemptId }) {
    console.log('🗑️ DISCARD AND EXIT:', { assignmentId, attemptId });
    
    // Set discard mode to prevent further commits
    this.discardMode = true;
    console.log('🗑️ Discard mode enabled - all commits will be skipped');
    
    // Remove auto-save handlers to prevent accidental saves
    this.removeAutoSaveHandlers();
    
    try {
      // Call backend discard endpoint
      const response = await fetch('/api/scorm/attempts/discard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assignmentId,
          attemptId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Discard API call failed:', errorText);
        throw new Error(`Discard failed: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Discard successful:', result);
      
      return result;
    } catch (error) {
      console.error('💥 Error during discard:', error);
      throw error;
    }
  }

  // NEW: Save and exit method (commits then closes)
  async saveAndExit({ assignmentId, attemptId }) {
    console.log('💾 SAVE AND EXIT:', { assignmentId, attemptId });
    
    try {
      // Perform final commit
      const standard = (this.data['cmi.completion_status'] !== undefined || this.data['cmi.success_status'] !== undefined) ? '2004' : '1.2';
      const commitResult = await this.commitWithRetry(standard, 'commit');
      
      if (commitResult === 'true') {
        console.log('✅ Save successful before exit');
        return { success: true, saved: true };
      } else {
        console.error('❌ Save failed before exit');
        throw new Error('Commit failed');
      }
    } catch (error) {
      console.error('💥 Error during save and exit:', error);
      throw error;
    }
  }
}

// API Discovery & Exposure Functions
function findAPI(win) {
  let findAttempts = 0;
  const findAttemptLimit = 500;
  
  while ((!win.API && !win.API_1484_11) && win.parent && win.parent !== win && findAttempts <= findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  
  return win.API_1484_11 || win.API || null;
}

function exposeScormAPI(assignmentId, learnerId, learnerName, onDataChange) {
  const scormAPI = new ScormAPI(assignmentId, learnerId, learnerName, onDataChange);
  
  // Cache the API for performance
  let cachedAPI = null;
  
  const getAPI = () => {
    if (cachedAPI) return cachedAPI;
    
    // Create combined API object that supports both SCORM 1.2 and 2004
    cachedAPI = {
      // SCORM 1.2 Methods
      LMSInitialize: scormAPI.LMSInitialize,
      LMSFinish: scormAPI.LMSFinish,
      LMSGetValue: scormAPI.LMSGetValue,
      LMSSetValue: scormAPI.LMSSetValue,
      LMSCommit: scormAPI.LMSCommit,
      LMSGetLastError: scormAPI.LMSGetLastError,
      LMSGetErrorString: scormAPI.LMSGetErrorString,
      LMSGetDiagnostic: scormAPI.LMSGetDiagnostic,
      
      // SCORM 2004 Methods
      Initialize: scormAPI.Initialize,
      Terminate: scormAPI.Terminate,
      GetValue: scormAPI.GetValue,
      SetValue: scormAPI.SetValue,
      Commit: scormAPI.Commit,
      GetLastError: scormAPI.GetLastError,
      GetErrorString: scormAPI.GetErrorString,
      GetDiagnostic: scormAPI.GetDiagnostic,
      
      // NEW: Discard and save methods for CoursePlayer
      discardAndExit: scormAPI.discardAndExit.bind(scormAPI),
      saveAndExit: scormAPI.saveAndExit.bind(scormAPI),
      
      // Internal reference to the ScormAPI instance
      _scormAPI: scormAPI
    };
    
    return cachedAPI;
  };
  
  // Expose window.API (SCORM 1.2) and window.API_1484_11 (SCORM 2004)
  window.API = getAPI();
  window.API_1484_11 = getAPI();
  
  console.log('🌐 SCORM APIs exposed: window.API and window.API_1484_11');
  
  // Setup exit safety
  const cleanupExitHandler = scormAPI.setupExitHandler();
  
  return {
    scormAPI,
    cleanup: () => {
      cleanupExitHandler();
      delete window.API;
      delete window.API_1484_11;
    }
  };
}

// Export for use in CoursePlayer
window.exposeScormAPI = exposeScormAPI;

console.log('📚 SCORM API module loaded');