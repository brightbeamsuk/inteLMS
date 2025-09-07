/**
 * SCORM 1.2 API Implementation for iSpring 11 Compatible Runtime
 * Returns SCORM-correct error codes and string responses
 */

export interface ScormAPI12 {
  LMSInitialize(parameter: string): string;
  LMSFinish(parameter: string): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(parameter: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(errorCode: string): string;
  LMSGetDiagnostic(errorParameter: string): string;
}

export class Scorm12API implements ScormAPI12 {
  private initialized = false;
  private terminated = false;
  private lastError = '0';
  private data: Record<string, string> = {};
  private attemptId: string;
  private onCommit: (data: Record<string, string>) => Promise<void>;
  private onTerminate: () => Promise<void>;

  // SCORM 1.2 Error Codes
  private readonly errorCodes: Record<string, string> = {
    '0': 'No error',
    '101': 'General exception',
    '201': 'Invalid argument error',
    '202': 'Element cannot have children',
    '203': 'Element not an array - cannot have count',
    '301': 'Not initialized',
    '401': 'Not implemented error',
    '402': 'Invalid set value, element is a keyword',
    '403': 'Element is read only',
    '404': 'Element is write only',
    '405': 'Incorrect data type'
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
    
    // Initialize with SCORM 1.2 defaults and any resume data
    this.data = {
      'cmi.core.lesson_status': 'not attempted',
      'cmi.core.score.raw': '',
      'cmi.core.score.min': '0',
      'cmi.core.score.max': '100',
      'cmi.core.lesson_location': '',
      'cmi.core.session_time': '00:00:00',
      'cmi.core.exit': '',
      'cmi.suspend_data': '',
      ...initialData // Resume data overrides defaults
    };
    
    console.log(`🎯 SCORM 1.2 API initialized for attempt: ${attemptId}`);
  }

  LMSInitialize(parameter: string): string {
    console.log(`🚀 SCORM 1.2 LMSInitialize("${parameter}")`);
    
    if (parameter !== '') {
      this.lastError = '201'; // Invalid argument error
      return 'false';
    }
    
    if (this.initialized) {
      this.lastError = '101'; // General exception - already initialized
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '101'; // General exception - cannot reinitialize after terminate
      return 'false';
    }
    
    this.initialized = true;
    this.terminated = false;
    this.lastError = '0';
    
    // Set lesson_status to incomplete if it was not attempted
    if (this.data['cmi.core.lesson_status'] === 'not attempted') {
      this.data['cmi.core.lesson_status'] = 'incomplete';
    }
    
    console.log(`✅ SCORM 1.2 initialized successfully`);
    return 'true';
  }

  LMSFinish(parameter: string): string {
    console.log(`🏁 SCORM 1.2 LMSFinish("${parameter}")`);
    
    if (parameter !== '') {
      this.lastError = '201'; // Invalid argument error
      return 'false';
    }
    
    if (!this.initialized) {
      this.lastError = '301'; // Not initialized
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '101'; // General exception - already terminated
      return 'false';
    }
    
    // Auto-commit before finishing
    try {
      this.commitData();
    } catch (error) {
      console.error('❌ Failed to commit on finish:', error);
      this.lastError = '101';
      return 'false';
    }
    
    this.terminated = true;
    this.initialized = false;
    this.lastError = '0';
    
    // Call terminate callback
    this.onTerminate().catch(error => {
      console.error('❌ Error in terminate callback:', error);
    });
    
    console.log(`✅ SCORM 1.2 finished successfully`);
    return 'true';
  }

  LMSGetValue(element: string): string {
    console.log(`📖 SCORM 1.2 LMSGetValue("${element}")`);
    
    if (!this.initialized) {
      this.lastError = '301'; // Not initialized
      return '';
    }
    
    if (this.terminated) {
      this.lastError = '101'; // General exception
      return '';
    }
    
    // Validate element name
    if (!this.isValidElement(element)) {
      this.lastError = '201'; // Invalid argument error
      return '';
    }
    
    // Check if element is write-only
    if (this.isWriteOnlyElement(element)) {
      this.lastError = '404'; // Element is write only
      return '';
    }
    
    const value = this.data[element] || '';
    this.lastError = '0';
    
    console.log(`📖 SCORM 1.2 GetValue("${element}") = "${value}"`);
    return value;
  }

  LMSSetValue(element: string, value: string): string {
    console.log(`📝 SCORM 1.2 LMSSetValue("${element}", "${value}")`);
    
    if (!this.initialized) {
      this.lastError = '301'; // Not initialized
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '101'; // General exception
      return 'false';
    }
    
    // Validate element name
    if (!this.isValidElement(element)) {
      this.lastError = '201'; // Invalid argument error
      return 'false';
    }
    
    // Check if element is read-only
    if (this.isReadOnlyElement(element)) {
      this.lastError = '403'; // Element is read only
      return 'false';
    }
    
    // Validate value based on element type
    if (!this.isValidValue(element, value)) {
      this.lastError = '405'; // Incorrect data type
      return 'false';
    }
    
    // Store the value
    this.data[element] = value;
    this.lastError = '0';
    
    console.log(`✅ SCORM 1.2 SetValue("${element}") = "${value}" stored`);
    return 'true';
  }

  LMSCommit(parameter: string): string {
    console.log(`💾 SCORM 1.2 LMSCommit("${parameter}")`);
    
    if (parameter !== '') {
      this.lastError = '201'; // Invalid argument error
      return 'false';
    }
    
    if (!this.initialized) {
      this.lastError = '301'; // Not initialized
      return 'false';
    }
    
    if (this.terminated) {
      this.lastError = '101'; // General exception
      return 'false';
    }
    
    try {
      this.commitData();
      this.lastError = '0';
      console.log(`✅ SCORM 1.2 commit successful`);
      return 'true';
    } catch (error) {
      console.error('❌ SCORM 1.2 commit failed:', error);
      this.lastError = '101'; // General exception
      return 'false';
    }
  }

  LMSGetLastError(): string {
    return this.lastError;
  }

  LMSGetErrorString(errorCode: string): string {
    return this.errorCodes[errorCode] || 'Unknown error';
  }

  LMSGetDiagnostic(errorParameter: string): string {
    // Return diagnostic information based on the last error
    const diagnostic = `SCORM 1.2 API - Error: ${this.lastError}, Parameter: ${errorParameter}, Attempt: ${this.attemptId}`;
    console.log(`🔍 SCORM 1.2 diagnostic: ${diagnostic}`);
    return diagnostic;
  }

  // Private helper methods
  private commitData(): void {
    console.log(`💾 Committing SCORM 1.2 data for attempt: ${this.attemptId}`);
    this.onCommit(this.data).catch(error => {
      console.error('❌ Commit callback failed:', error);
      throw error;
    });
  }

  private isValidElement(element: string): boolean {
    const validElements = [
      'cmi.core.lesson_status',
      'cmi.core.score.raw',
      'cmi.core.score.min', 
      'cmi.core.score.max',
      'cmi.core.lesson_location',
      'cmi.core.session_time',
      'cmi.core.student_id',
      'cmi.core.student_name',
      'cmi.core.exit',
      'cmi.suspend_data',
      'cmi.launch_data',
      'cmi.comments',
      'cmi.student_data.mastery_score',
      'cmi.student_data.max_time_allowed',
      'cmi.student_data.time_limit_action'
    ];
    
    return validElements.includes(element);
  }

  private isReadOnlyElement(element: string): boolean {
    const readOnlyElements = [
      'cmi.core.student_id',
      'cmi.core.student_name',
      'cmi.launch_data',
      'cmi.student_data.mastery_score',
      'cmi.student_data.max_time_allowed',
      'cmi.student_data.time_limit_action'
    ];
    
    return readOnlyElements.includes(element);
  }

  private isWriteOnlyElement(element: string): boolean {
    const writeOnlyElements = [
      'cmi.core.session_time',
      'cmi.core.exit'
    ];
    
    return writeOnlyElements.includes(element);
  }

  private isValidValue(element: string, value: string): boolean {
    // Validate specific element values
    switch (element) {
      case 'cmi.core.lesson_status':
        return ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'].includes(value);
      
      case 'cmi.core.exit':
        return ['time-out', 'suspend', 'logout', ''].includes(value);
      
      case 'cmi.core.score.raw':
      case 'cmi.core.score.min':
      case 'cmi.core.score.max':
        // Allow empty string or valid number
        return value === '' || (!isNaN(parseFloat(value)) && isFinite(Number(value)));
      
      case 'cmi.core.session_time':
        // Validate CMI timespan format (HH:MM:SS or HH:MM:SS.SS)
        return /^\d{2,}:\d{2}:\d{2}(\.\d{2})?$/.test(value);
      
      default:
        return true; // Allow any string for other elements
    }
  }
}