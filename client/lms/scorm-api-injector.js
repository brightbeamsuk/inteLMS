/**
 * SCORM API Injector for iSpring 11 Compatible Runtime
 * Exposes SCORM APIs to browser window with frame traversal support
 * Handles both SCORM 1.2 and SCORM 2004 standards
 */

(function() {
  'use strict';

  // Configuration
  const DEBUG = true; // Set to false in production
  const MAX_FIND_API_TRIES = 500;
  const API_TIMEOUT = 10000; // 10 seconds

  // SCORM API state
  let currentAttemptId = null;
  let currentStandard = null;
  let apiInitialized = false;
  let commitRetryCount = 0;
  const MAX_COMMIT_RETRIES = 3;

  // In-memory data store to mirror SCORM values
  let scormData = {};
  
  // Error tracking
  let lastError = '0';

  function log(message, data = null) {
    if (DEBUG) {
      console.log(`[SCORM-Injector] ${message}`, data || '');
    }
  }

  function error(message, err = null) {
    console.error(`[SCORM-Injector] ❌ ${message}`, err || '');
  }

  /**
   * Make API request to server
   */
  async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send commit request to server
   */
  async function commitToServer(data) {
    if (!currentAttemptId) {
      throw new Error('No attempt ID available for commit');
    }

    log(`Committing data to server for attempt: ${currentAttemptId}`, data);

    try {
      const response = await apiRequest(
        `/api/scorm/runtime/${currentAttemptId}/commit`,
        'POST',
        data
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Commit failed');
      }

      commitRetryCount = 0; // Reset on success
      log('✅ Data committed successfully');
      return true;

    } catch (err) {
      error('Commit failed:', err);
      
      // Retry logic
      if (commitRetryCount < MAX_COMMIT_RETRIES) {
        commitRetryCount++;
        log(`Retrying commit (attempt ${commitRetryCount}/${MAX_COMMIT_RETRIES})`);
        
        // Exponential backoff
        const delay = Math.pow(2, commitRetryCount - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return commitToServer(data);
      }
      
      throw err;
    }
  }

  /**
   * Log SCORM API call for debugging
   */
  async function logScormCall(method, args, result) {
    if (DEBUG || window.SCORM_DEBUG) {
      try {
        await apiRequest('/api/scorm/log', 'POST', {
          attemptId: currentAttemptId,
          method,
          args: Array.isArray(args) ? args : [args],
          result,
          timestamp: new Date().toISOString(),
          standard: currentStandard
        });
      } catch (err) {
        // Don't fail SCORM operations if logging fails
        console.warn('SCORM logging failed:', err);
      }
    }
  }

  /**
   * Create SCORM 1.2 API
   */
  function createScorm12API(attemptId) {
    log('Creating SCORM 1.2 API');
    
    const api = {
      // Initialize the SCORM session
      LMSInitialize: function(parameter) {
        log(`LMSInitialize("${parameter}")`);
        
        if (parameter !== '') {
          lastError = '201';
          logScormCall('LMSInitialize', [parameter], 'false');
          return 'false';
        }
        
        if (apiInitialized) {
          lastError = '101';
          logScormCall('LMSInitialize', [parameter], 'false');
          return 'false';
        }
        
        apiInitialized = true;
        lastError = '0';
        
        // Set lesson_status to incomplete if not attempted
        if (!scormData['cmi.core.lesson_status'] || scormData['cmi.core.lesson_status'] === 'not attempted') {
          scormData['cmi.core.lesson_status'] = 'incomplete';
        }
        
        logScormCall('LMSInitialize', [parameter], 'true');
        return 'true';
      },

      // Finish the SCORM session
      LMSFinish: function(parameter) {
        log(`LMSFinish("${parameter}")`);
        
        if (parameter !== '') {
          lastError = '201';
          logScormCall('LMSFinish', [parameter], 'false');
          return 'false';
        }
        
        if (!apiInitialized) {
          lastError = '301';
          logScormCall('LMSFinish', [parameter], 'false');
          return 'false';
        }
        
        // Auto-commit before finishing
        try {
          api.LMSCommit('');
          apiInitialized = false;
          lastError = '0';
          logScormCall('LMSFinish', [parameter], 'true');
          return 'true';
        } catch (err) {
          lastError = '101';
          logScormCall('LMSFinish', [parameter], 'false');
          return 'false';
        }
      },

      // Get value from SCORM data model
      LMSGetValue: function(element) {
        if (!apiInitialized) {
          lastError = '301';
          logScormCall('LMSGetValue', [element], '');
          return '';
        }
        
        const value = scormData[element] || '';
        lastError = '0';
        
        log(`LMSGetValue("${element}") = "${value}"`);
        logScormCall('LMSGetValue', [element], value);
        return value;
      },

      // Set value in SCORM data model
      LMSSetValue: function(element, value) {
        if (!apiInitialized) {
          lastError = '301';
          logScormCall('LMSSetValue', [element, value], 'false');
          return 'false';
        }
        
        scormData[element] = value;
        lastError = '0';
        
        log(`LMSSetValue("${element}", "${value}")`);
        logScormCall('LMSSetValue', [element, value], 'true');
        return 'true';
      },

      // Commit SCORM data to server
      LMSCommit: function(parameter) {
        if (parameter !== '') {
          lastError = '201';
          logScormCall('LMSCommit', [parameter], 'false');
          return 'false';
        }
        
        if (!apiInitialized) {
          lastError = '301';
          logScormCall('LMSCommit', [parameter], 'false');
          return 'false';
        }
        
        log('LMSCommit called, sending data to server');
        
        // Commit asynchronously but return immediately for SCORM compliance
        commitToServer(scormData)
          .then(() => log('✅ Async commit completed'))
          .catch(err => error('❌ Async commit failed:', err));
        
        lastError = '0';
        logScormCall('LMSCommit', [parameter], 'true');
        return 'true';
      },

      // Error handling
      LMSGetLastError: function() {
        return lastError;
      },

      LMSGetErrorString: function(errorCode) {
        const errorStrings = {
          '0': 'No error',
          '101': 'General exception',
          '201': 'Invalid argument error',
          '301': 'Not initialized',
          '401': 'Not implemented error',
          '403': 'Element is read only',
          '404': 'Element is write only',
          '405': 'Incorrect data type'
        };
        return errorStrings[errorCode] || 'Unknown error';
      },

      LMSGetDiagnostic: function(errorParameter) {
        const diagnostic = `SCORM 1.2 - Error: ${lastError}, Attempt: ${attemptId}`;
        log(`LMSGetDiagnostic: ${diagnostic}`);
        return diagnostic;
      }
    };

    return api;
  }

  /**
   * Create SCORM 2004 API
   */
  function createScorm2004API(attemptId) {
    log('Creating SCORM 2004 API');
    
    const api = {
      // Initialize the SCORM session
      Initialize: function(parameter) {
        log(`Initialize("${parameter}")`);
        
        if (parameter !== '') {
          lastError = '201';
          logScormCall('Initialize', [parameter], 'false');
          return 'false';
        }
        
        if (apiInitialized) {
          lastError = '103';
          logScormCall('Initialize', [parameter], 'false');
          return 'false';
        }
        
        apiInitialized = true;
        lastError = '0';
        
        // Set completion_status to incomplete if not attempted
        if (!scormData['cmi.completion_status'] || scormData['cmi.completion_status'] === 'not attempted') {
          scormData['cmi.completion_status'] = 'incomplete';
        }
        
        logScormCall('Initialize', [parameter], 'true');
        return 'true';
      },

      // Terminate the SCORM session
      Terminate: function(parameter) {
        log(`Terminate("${parameter}")`);
        
        if (parameter !== '') {
          lastError = '201';
          logScormCall('Terminate', [parameter], 'false');
          return 'false';
        }
        
        if (!apiInitialized) {
          lastError = '112';
          logScormCall('Terminate', [parameter], 'false');
          return 'false';
        }
        
        // Auto-commit before terminating
        try {
          api.Commit('');
          apiInitialized = false;
          lastError = '0';
          logScormCall('Terminate', [parameter], 'true');
          return 'true';
        } catch (err) {
          lastError = '111';
          logScormCall('Terminate', [parameter], 'false');
          return 'false';
        }
      },

      // Get value from SCORM data model
      GetValue: function(element) {
        if (!apiInitialized) {
          lastError = '122';
          logScormCall('GetValue', [element], '');
          return '';
        }
        
        const value = scormData[element] || '';
        lastError = '0';
        
        log(`GetValue("${element}") = "${value}"`);
        logScormCall('GetValue', [element], value);
        return value;
      },

      // Set value in SCORM data model
      SetValue: function(element, value) {
        if (!apiInitialized) {
          lastError = '132';
          logScormCall('SetValue', [element, value], 'false');
          return 'false';
        }
        
        scormData[element] = value;
        lastError = '0';
        
        log(`SetValue("${element}", "${value}")`);
        logScormCall('SetValue', [element, value], 'true');
        return 'true';
      },

      // Commit SCORM data to server
      Commit: function(parameter) {
        if (parameter !== '') {
          lastError = '201';
          logScormCall('Commit', [parameter], 'false');
          return 'false';
        }
        
        if (!apiInitialized) {
          lastError = '142';
          logScormCall('Commit', [parameter], 'false');
          return 'false';
        }
        
        log('Commit called, sending data to server');
        
        // Commit asynchronously but return immediately for SCORM compliance
        commitToServer(scormData)
          .then(() => log('✅ Async commit completed'))
          .catch(err => error('❌ Async commit failed:', err));
        
        lastError = '0';
        logScormCall('Commit', [parameter], 'true');
        return 'true';
      },

      // Error handling
      GetLastError: function() {
        return lastError;
      },

      GetErrorString: function(errorCode) {
        const errorStrings = {
          '0': 'No error',
          '101': 'General exception',
          '103': 'Already initialized',
          '111': 'General termination failure',
          '112': 'Termination before initialization',
          '122': 'Retrieve data before initialization',
          '132': 'Store data before initialization',
          '142': 'Commit before initialization',
          '201': 'General argument error',
          '401': 'Undefined data model element',
          '404': 'Data model element is read only'
        };
        return errorStrings[errorCode] || 'Unknown error';
      },

      GetDiagnostic: function(errorParameter) {
        const diagnostic = `SCORM 2004 - Error: ${lastError}, Attempt: ${attemptId}`;
        log(`GetDiagnostic: ${diagnostic}`);
        return diagnostic;
      }
    };

    return api;
  }

  /**
   * Initialize SCORM APIs with attempt data
   */
  function initializeAPIs(config) {
    log('Initializing SCORM APIs with config:', config);
    
    currentAttemptId = config.attemptId;
    currentStandard = config.standard;
    
    // Initialize data store with resume data
    scormData = { ...config.initialData };
    
    // Create and expose appropriate API
    if (config.standard === '1.2') {
      window.API = createScorm12API(config.attemptId);
      log('✅ SCORM 1.2 API exposed on window.API');
    } else {
      window.API_1484_11 = createScorm2004API(config.attemptId);
      log('✅ SCORM 2004 API exposed on window.API_1484_11');
    }
    
    // Add beforeunload listener for emergency commits
    window.addEventListener('beforeunload', function() {
      if (apiInitialized && Object.keys(scormData).length > 0) {
        log('Emergency commit on page unload');
        // Use synchronous approach for page unload
        navigator.sendBeacon('/api/scorm/runtime/' + currentAttemptId + '/commit', 
                           JSON.stringify(scormData));
      }
    });
    
    // SCORM 2004 (3rd Ed.) Auto-commit safety features
    let autoCommitTimer = null;
    
    function performAutoCommit() {
      if (apiInitialized && Object.keys(scormData).length > 0) {
        log('🔄 Auto-commit triggered - saving SCORM data');
        commitToServer(scormData).catch(err => {
          error('Auto-commit failed:', err);
        });
      }
    }
    
    // Auto-commit every 60 seconds
    function startAutoCommitTimer() {
      if (autoCommitTimer) {
        clearInterval(autoCommitTimer);
      }
      autoCommitTimer = setInterval(performAutoCommit, 60000); // 60 seconds
      log('⏰ Auto-commit timer started (60s intervals)');
    }
    
    // Auto-commit on visibility changes (when tab becomes hidden)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        log('👁️ Page hidden - triggering auto-commit');
        performAutoCommit();
      }
    });
    
    // Auto-commit on page hide (more reliable than beforeunload)
    window.addEventListener('pagehide', function() {
      log('🚪 Page hide - triggering auto-commit');
      // Use beacon for reliability during page transitions
      if (apiInitialized && Object.keys(scormData).length > 0) {
        navigator.sendBeacon('/api/scorm/runtime/' + currentAttemptId + '/commit', 
                           JSON.stringify(scormData));
      }
    });
    
    // Start the auto-commit timer
    startAutoCommitTimer();
    
    log('🚀 SCORM API Injector initialized successfully');
    return true;
  }

  /**
   * Frame traversal API discovery
   * Allows SCORM content to find the API from frames/iframes
   */
  function findAPI(win, findAPITries) {
    if (findAPITries > MAX_FIND_API_TRIES) {
      return null;
    }
    
    // Check current window for API
    if (currentStandard === '1.2' && win.API) {
      return win.API;
    } else if (currentStandard === '2004' && win.API_1484_11) {
      return win.API_1484_11;
    }
    
    // Check parent if available
    if (win.parent && win.parent !== win) {
      const api = findAPI(win.parent, findAPITries + 1);
      if (api) return api;
    }
    
    // Check opener if available
    if (win.opener) {
      const api = findAPI(win.opener, findAPITries + 1);
      if (api) return api;
    }
    
    return null;
  }

  // Export initialization function
  window.initializeScormAPI = initializeAPIs;
  
  // Export findAPI for SCORM content
  window.findAPI = function() {
    return findAPI(window, 0);
  };
  
  log('📚 SCORM API Injector loaded and ready');

})();