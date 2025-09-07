/**
 * SCORM 2004 API Implementation for iSpring 11 Compatible Runtime
 * Returns SCORM-correct error codes and string responses
 */

export interface ScormAPI2004 {
  Initialize(parameter: string): string;
  Terminate(parameter: string): string;
  GetValue(element: string): string;
  SetValue(element: string, value: string): string;
  Commit(parameter: string): string;
  GetLastError(): string;
  GetErrorString(errorCode: string): string;
  GetDiagnostic(errorParameter: string): string;
}

export class Scorm2004API implements ScormAPI2004 {
  private initialized = false;
  private terminated = false;
  private lastError = '0';
  private data: Record<string, string> = {};
  private attemptId: string;
  private onCommit: (data: Record<string, string>) => Promise<void>;
  private onTerminate: () => Promise<void>;

  // SCORM 2004 Error Codes
  private readonly errorCodes: Record<string, string> = {
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
    '201': 'General argument error',
    '301': 'General get failure',
    '351': 'General set failure',
    '391': 'General commit failure',
    '401': 'Undefined data model element',
    '402': 'Unimplemented data model element',
    '403': 'Data model element value not initialized',
    '404': 'Data model element is read only',
    '405': 'Data model element is write only',
    '406': 'Data model element type mismatch',
    '407': 'Data model element value out of range',
    '408': 'Data model dependency not established'
  };

  constructor(
    attemptId: string,
    onCommit: (data: Record<string, string>) => Promise<void>,
    onTerminate: () => Promise<void>,
    initialData: Record<string, string> = {}
  ) {
    this.attemptId = attemptId;
    this.onCommit = onCommit;
    this.onTerminate = onTerminate;
    
    // Initialize with SCORM 2004 defaults and any resume data
    this.data = {
      'cmi.completion_status': 'not attempted',
      'cmi.success_status': 'unknown',
      'cmi.score.raw': '',
      'cmi.score.scaled': '',
      'cmi.score.min': '0',
      'cmi.score.max': '100',
      'cmi.location': '',
      'cmi.session_time': 'PT0H0M0S',
      'cmi.progress_measure': '',
      'cmi.exit': '',
      'cmi.suspend_data': '',
      ...initialData // Resume data overrides defaults
    };
    
    console.log(`🎯 SCORM 2004 API initialized for attempt: ${attemptId}`);
  }

  Initialize(parameter: string): string {
    console.log(`🚀 SCORM 2004 Initialize("${parameter}")`);
    
    if (parameter !== '') {
      this.lastError = '201'; // General argument error
      return 'false';
    }
    
    if (this.initialized) {
      this.lastError = '103'; // Already initialized
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '104'; // Content instance terminated
      return 'false';
    }
    
    this.initialized = true;
    this.terminated = false;
    this.lastError = '0';
    
    // Set completion_status to incomplete if it was not attempted
    if (this.data['cmi.completion_status'] === 'not attempted') {
      this.data['cmi.completion_status'] = 'incomplete';
    }
    
    console.log(`✅ SCORM 2004 initialized successfully`);
    return 'true';
  }

  Terminate(parameter: string): string {
    console.log(`🏁 SCORM 2004 Terminate("${parameter}")`);
    
    if (parameter !== '') {
      this.lastError = '201'; // General argument error
      return 'false';
    }
    
    if (!this.initialized) {
      this.lastError = '112'; // Termination before initialization
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '113'; // Termination after termination
      return 'false';
    }
    
    // Auto-commit before terminating
    try {
      this.commitData();
    } catch (error) {
      console.error('❌ Failed to commit on terminate:', error);
      this.lastError = '111';
      return 'false';
    }
    
    this.terminated = true;
    this.initialized = false;
    this.lastError = '0';
    
    // Call terminate callback
    this.onTerminate().catch(error => {
      console.error('❌ Error in terminate callback:', error);
    });
    
    console.log(`✅ SCORM 2004 terminated successfully`);
    return 'true';
  }

  GetValue(element: string): string {
    console.log(`📖 SCORM 2004 GetValue("${element}")`);
    
    if (!this.initialized) {
      this.lastError = '122'; // Retrieve data before initialization
      return '';
    }
    
    if (this.terminated) {
      this.lastError = '123'; // Retrieve data after termination
      return '';
    }
    
    // Validate element name
    if (!this.isValidElement(element)) {
      this.lastError = '401'; // Undefined data model element
      return '';
    }
    
    // Check if element is write-only
    if (this.isWriteOnlyElement(element)) {
      this.lastError = '405'; // Data model element is write only
      return '';
    }
    
    const value = this.data[element] || '';
    this.lastError = '0';
    
    console.log(`📖 SCORM 2004 GetValue("${element}") = "${value}"`);
    return value;
  }

  SetValue(element: string, value: string): string {
    console.log(`📝 SCORM 2004 SetValue("${element}", "${value}")`);
    
    if (!this.initialized) {
      this.lastError = '132'; // Store data before initialization
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '133'; // Store data after termination
      return 'false';
    }
    
    // Validate element name
    if (!this.isValidElement(element)) {
      this.lastError = '401'; // Undefined data model element
      return 'false';
    }
    
    // Check if element is read-only
    if (this.isReadOnlyElement(element)) {
      this.lastError = '404'; // Data model element is read only
      return 'false';
    }
    
    // Validate value based on element type
    const validation = this.validateValue(element, value);
    if (!validation.valid) {
      this.lastError = validation.errorCode;
      return 'false';
    }
    
    // Store the value
    this.data[element] = value;
    this.lastError = '0';
    
    console.log(`✅ SCORM 2004 SetValue("${element}") = "${value}" stored`);
    return 'true';
  }

  Commit(parameter: string): string {
    console.log(`💾 SCORM 2004 Commit("${parameter}")`);
    
    if (parameter !== '') {
      this.lastError = '201'; // General argument error
      return 'false';
    }
    
    if (!this.initialized) {
      this.lastError = '142'; // Commit before initialization
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '143'; // Commit after termination
      return 'false';
    }
    
    try {
      this.commitData();
      this.lastError = '0';
      console.log(`✅ SCORM 2004 commit successful`);
      return 'true';
    } catch (error) {
      console.error('❌ SCORM 2004 commit failed:', error);
      this.lastError = '391'; // General commit failure
      return 'false';
    }
  }

  GetLastError(): string {
    return this.lastError;
  }

  GetErrorString(errorCode: string): string {
    return this.errorCodes[errorCode] || 'Unknown error';
  }

  GetDiagnostic(errorParameter: string): string {
    // Return diagnostic information based on the last error
    const diagnostic = `SCORM 2004 API - Error: ${this.lastError}, Parameter: ${errorParameter}, Attempt: ${this.attemptId}`;
    console.log(`🔍 SCORM 2004 diagnostic: ${diagnostic}`);
    return diagnostic;
  }

  // Private helper methods
  private commitData(): void {
    console.log(`💾 Committing SCORM 2004 data for attempt: ${this.attemptId}`);
    this.onCommit(this.data).catch(error => {
      console.error('❌ Commit callback failed:', error);
      throw error;
    });
  }

  private isValidElement(element: string): boolean {
    const validElements = [
      'cmi.completion_status',
      'cmi.success_status',
      'cmi.score.raw',
      'cmi.score.scaled',
      'cmi.score.min',
      'cmi.score.max',
      'cmi.location',
      'cmi.session_time',
      'cmi.progress_measure',
      'cmi.learner_id',
      'cmi.learner_name',
      'cmi.exit',
      'cmi.suspend_data',
      'cmi.launch_data',
      'cmi.comments_from_learner._count',
      'cmi.comments_from_learner._children',
      'cmi.comments_from_lms._count',
      'cmi.comments_from_lms._children',
      'cmi.learner_preference.audio_level',
      'cmi.learner_preference.language',
      'cmi.learner_preference.delivery_speed',
      'cmi.learner_preference.audio_captioning'
    ];
    
    // Support dynamic elements with indices
    const dynamicPatterns = [
      /^cmi\.comments_from_learner\.\d+\.(comment|location|timestamp)$/,
      /^cmi\.comments_from_lms\.\d+\.(comment|location|timestamp)$/,
      /^cmi\.interactions\.\d+\.(id|type|objectives\._count|timestamp|correct_responses\._count|weighting|learner_response|result|latency|description)$/,
      /^cmi\.objectives\.\d+\.(id|score\.(scaled|raw|min|max)|success_status|completion_status|progress_measure|description)$/
    ];
    
    if (validElements.includes(element)) {
      return true;
    }
    
    return dynamicPatterns.some(pattern => pattern.test(element));
  }

  private isReadOnlyElement(element: string): boolean {
    const readOnlyElements = [
      'cmi.learner_id',
      'cmi.learner_name',
      'cmi.launch_data',
      'cmi.comments_from_lms._count',
      'cmi.comments_from_lms._children'
    ];
    
    const readOnlyPatterns = [
      /^cmi\.comments_from_lms\.\d+\.(comment|location|timestamp)$/
    ];
    
    return readOnlyElements.includes(element) ||
           readOnlyPatterns.some(pattern => pattern.test(element));
  }

  private isWriteOnlyElement(element: string): boolean {
    const writeOnlyElements = [
      'cmi.session_time',
      'cmi.exit'
    ];
    
    return writeOnlyElements.includes(element);
  }

  private validateValue(element: string, value: string): { valid: boolean; errorCode: string } {
    switch (element) {
      case 'cmi.completion_status':
        if (!['completed', 'incomplete', 'not attempted', 'unknown'].includes(value)) {
          return { valid: false, errorCode: '407' }; // Value out of range
        }
        break;
      
      case 'cmi.success_status':
        if (!['passed', 'failed', 'unknown'].includes(value)) {
          return { valid: false, errorCode: '407' }; // Value out of range
        }
        break;
      
      case 'cmi.exit':
        if (!['time-out', 'suspend', 'logout', 'normal', ''].includes(value)) {
          return { valid: false, errorCode: '407' }; // Value out of range
        }
        break;
      
      case 'cmi.progress_measure':
        if (value !== '') {
          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue < 0 || numValue > 1) {
            return { valid: false, errorCode: '407' }; // Value out of range (0-1)
          }
        }
        break;
      
      case 'cmi.score.raw':
      case 'cmi.score.min':
      case 'cmi.score.max':
        if (value !== '' && (isNaN(parseFloat(value)) || !isFinite(Number(value)))) {
          return { valid: false, errorCode: '406' }; // Type mismatch
        }
        break;
      
      case 'cmi.score.scaled':
        if (value !== '') {
          const scaledValue = parseFloat(value);
          if (isNaN(scaledValue) || scaledValue < -1 || scaledValue > 1) {
            return { valid: false, errorCode: '407' }; // Value out of range (-1 to 1)
          }
        }
        break;
      
      case 'cmi.session_time':
        // Validate ISO 8601 duration format (PT[n]H[n]M[n]S)
        if (!/^PT(\d+H)?(\d+M)?(\d+(\.\d{1,2})?S)?$/.test(value)) {
          return { valid: false, errorCode: '406' }; // Type mismatch
        }
        break;
      
      default:
        // Most other elements accept any string
        break;
    }
    
    return { valid: true, errorCode: '0' };
  }
}