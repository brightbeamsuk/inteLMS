import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoursePlayerProps {
  assignmentId: string;
  courseTitle: string;
  onComplete: () => void;
  onClose: () => void;
}

interface ScormAttemptState {
  // SCORM 1.2 CMI values
  'cmi.core.lesson_status': string;
  'cmi.core.score.raw': string;
  'cmi.core.score.min': string;
  'cmi.core.score.max': string;
  'cmi.core.lesson_location': string;
  'cmi.core.session_time': string;
  'cmi.core.student_id': string;
  'cmi.core.student_name': string;
  
  // SCORM 2004 CMI values
  'cmi.completion_status': string;
  'cmi.success_status': string;
  'cmi.score.raw': string;
  'cmi.score.scaled': string;
  'cmi.score.min': string;
  'cmi.score.max': string;
  'cmi.location': string;
  'cmi.session_time': string;
  'cmi.learner_id': string;
  'cmi.learner_name': string;
}

export function CoursePlayer({ assignmentId, courseTitle, onComplete, onClose }: CoursePlayerProps) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [scormUrl, setScormUrl] = useState<string>('');
  const [attemptId, setAttemptId] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [scormInitialized, setScormInitialized] = useState(false);
  const [showInitWarning, setShowInitWarning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const attemptStateRef = useRef<ScormAttemptState>({
    // SCORM 1.2 defaults
    'cmi.core.lesson_status': 'incomplete',
    'cmi.core.score.raw': '',
    'cmi.core.score.min': '0',
    'cmi.core.score.max': '100',
    'cmi.core.lesson_location': '',
    'cmi.core.session_time': '00:00:00',
    'cmi.core.student_id': '',
    'cmi.core.student_name': '',
    
    // SCORM 2004 defaults  
    'cmi.completion_status': 'incomplete',
    'cmi.success_status': 'unknown',
    'cmi.score.raw': '',
    'cmi.score.scaled': '',
    'cmi.score.min': '0',
    'cmi.score.max': '100',
    'cmi.location': '',
    'cmi.session_time': 'PT0H0M0S',
    'cmi.learner_id': '',
    'cmi.learner_name': ''
  });
  const startTimeRef = useRef<number>(Date.now());
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loggedKeys = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const sendScormResult = async (reason: 'commit' | 'finish') => {
    try {
      const state = attemptStateRef.current;
      const scormVersion = state['cmi.core.lesson_status'] !== undefined ? '1.2' : '2004';
      
      await apiRequest('POST', '/api/scorm/result', {
        learnerId: state['cmi.core.student_id'] || state['cmi.learner_id'],
        courseId: assignmentId,
        attemptId,
        scormVersion,
        score: state['cmi.core.score.raw'] || state['cmi.score.raw'],
        status: state['cmi.core.lesson_status'] || state['cmi.completion_status'],
        successStatus: state['cmi.success_status'],
        scaledScore: state['cmi.score.scaled'],
        reason,
        sessionTime: state['cmi.core.session_time'] || state['cmi.session_time'],
        location: state['cmi.core.lesson_location'] || state['cmi.location']
      });
      
      addDebugLog(`✅ SCORM result sent (${reason}): ${JSON.stringify({score: state['cmi.core.score.raw'] || state['cmi.score.raw'], status: state['cmi.core.lesson_status'] || state['cmi.completion_status']})}`);
    } catch (error) {
      console.error('Failed to send SCORM result:', error);
      addDebugLog(`❌ Failed to send SCORM result: ${error}`);
    }
  };

  // SCORM 1.2 API Implementation
  const scorm12API = {
    LMSInitialize: (param: string) => {
      console.log('📡 SCO initialised (1.2)');
      addDebugLog('🎯 SCORM 1.2: LMSInitialize called');
      setScormInitialized(true);
      setShowInitWarning(false);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      startTimeRef.current = Date.now();
      return "true";
    },
    
    LMSGetValue: (element: string) => {
      const value = attemptStateRef.current[element as keyof ScormAttemptState] || "";
      addDebugLog(`📖 SCORM 1.2: LMSGetValue(${element}) = ${value}`);
      return value;
    },
    
    LMSSetValue: (element: string, value: string) => {
      // Log first 10 unique keys only
      if (!loggedKeys.current.has(element) && loggedKeys.current.size < 10) {
        console.log(`📊 SCORM SetValue key: ${element}`);
        loggedKeys.current.add(element);
      }
      
      addDebugLog(`✏️ SCORM 1.2: LMSSetValue(${element}, ${value})`);
      
      // Update the attempt state
      if (element in attemptStateRef.current) {
        (attemptStateRef.current as any)[element] = value;
      }
      
      // Calculate progress based on lesson status and score
      if (element === 'cmi.core.lesson_status') {
        if (value === 'completed' || value === 'passed') {
          setProgress(100);
        } else if (value === 'incomplete') {
          setProgress(50);
        }
      }
      
      return "true";
    },
    
    LMSCommit: (param: string) => {
      addDebugLog('💾 SCORM 1.2: LMSCommit called');
      sendScormResult('commit');
      return "true";
    },
    
    LMSFinish: (param: string) => {
      addDebugLog('🏁 SCORM 1.2: LMSFinish called');
      
      // Update session time
      const sessionSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const hours = Math.floor(sessionSeconds / 3600);
      const minutes = Math.floor((sessionSeconds % 3600) / 60);
      const seconds = sessionSeconds % 60;
      attemptStateRef.current['cmi.core.session_time'] = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      sendScormResult('finish');
      return "true";
    },
    
    LMSGetLastError: () => "0",
    LMSGetErrorString: (errorCode: string) => "",
    LMSGetDiagnostic: (errorCode: string) => ""
  };

  // SCORM 2004 API Implementation
  const scorm2004API = {
    Initialize: (param: string) => {
      console.log('📡 SCO initialised (2004)');
      addDebugLog('🎯 SCORM 2004: Initialize called');
      setScormInitialized(true);
      setShowInitWarning(false);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      startTimeRef.current = Date.now();
      return "true";
    },
    
    GetValue: (element: string) => {
      const value = attemptStateRef.current[element as keyof ScormAttemptState] || "";
      addDebugLog(`📖 SCORM 2004: GetValue(${element}) = ${value}`);
      return value;
    },
    
    SetValue: (element: string, value: string) => {
      // Log first 10 unique keys only
      if (!loggedKeys.current.has(element) && loggedKeys.current.size < 10) {
        console.log(`📊 SCORM SetValue key: ${element}`);
        loggedKeys.current.add(element);
      }
      
      addDebugLog(`✏️ SCORM 2004: SetValue(${element}, ${value})`);
      
      // Update the attempt state
      if (element in attemptStateRef.current) {
        (attemptStateRef.current as any)[element] = value;
      }
      
      // Calculate progress based on completion status and score
      if (element === 'cmi.completion_status') {
        if (value === 'completed') {
          setProgress(100);
        } else if (value === 'incomplete') {
          setProgress(50);
        }
      }
      
      return "true";
    },
    
    Commit: (param: string) => {
      addDebugLog('💾 SCORM 2004: Commit called');
      sendScormResult('commit');
      return "true";
    },
    
    Terminate: (param: string) => {
      addDebugLog('🏁 SCORM 2004: Terminate called');
      
      // Update session time (ISO 8601 duration format)
      const sessionSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const hours = Math.floor(sessionSeconds / 3600);
      const minutes = Math.floor((sessionSeconds % 3600) / 60);
      const seconds = sessionSeconds % 60;
      attemptStateRef.current['cmi.session_time'] = `PT${hours}H${minutes}M${seconds}S`;
      
      sendScormResult('finish');
      return "true";
    },
    
    GetLastError: () => "0",
    GetErrorString: (errorCode: string) => "",
    GetDiagnostic: (errorCode: string) => ""
  };

  useEffect(() => {
    // Initialize SCORM course data
    const initializeCourse = async () => {
      try {
        // Generate new attempt ID
        const newAttemptId = `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setAttemptId(newAttemptId);
        
        // Get current user info
        const userResponse = await apiRequest('GET', '/api/auth/user');
        attemptStateRef.current['cmi.core.student_id'] = userResponse.id;
        attemptStateRef.current['cmi.core.student_name'] = `${userResponse.firstName || ''} ${userResponse.lastName || ''}`.trim();
        attemptStateRef.current['cmi.learner_id'] = userResponse.id;
        attemptStateRef.current['cmi.learner_name'] = `${userResponse.firstName || ''} ${userResponse.lastName || ''}`.trim();
        
        // Get course launch URL using improved SCORM processing
        try {
          const launchResponse = await apiRequest('GET', `/api/scorm/${assignmentId}/launch`);
          console.log('✅ Launch data received:', launchResponse);
          
          // Use launch URL override if available, otherwise use parsed URL
          const finalLaunchUrl = launchResponse.launchUrlOverride || launchResponse.launchUrl;
          
          // Log launch URL before setting iframe
          console.log(`🎯 Launch URL set: ${finalLaunchUrl || '(none)'}`);
          console.log(`📋 SCORM Version: ${launchResponse.scormVersion}`);
          
          if (launchResponse.diagnostics) {
            console.log('🔍 SCORM Diagnostics:', launchResponse.diagnostics);
            addDebugLog(`📊 Diagnostics: ${JSON.stringify(launchResponse.diagnostics, null, 2)}`);
          }
          
          setScormUrl(finalLaunchUrl);
          addDebugLog(`🎯 Launch URL set: ${finalLaunchUrl || '(none)'}`);
        } catch (launchError: any) {
          console.error('❌ SCORM launch failed:', launchError);
          
          // Handle specific SCORM errors with user-friendly messages
          let errorMessage = 'Failed to launch course. Please contact support.';
          
          if (launchError.message?.includes('LAUNCH_FILE_NOT_FOUND')) {
            errorMessage = 'Course launch file not found. The SCORM package appears to be corrupted.';
          } else if (launchError.message?.includes('INVALID_MANIFEST')) {
            errorMessage = 'This SCORM package is missing required files. Please contact your administrator.';
          } else if (launchError.message?.includes('INVALID_ZIP')) {
            errorMessage = 'The course package is corrupted. Please contact your administrator.';
          } else if (launchError.message?.includes('not found')) {
            errorMessage = 'Course not found or no longer available.';
          } else if (launchError.message?.includes('permission')) {
            errorMessage = 'You do not have permission to access this course.';
          }
          
          addDebugLog(`❌ Launch error: ${errorMessage}`);
          
          toast({
            title: "Course Launch Failed",
            description: errorMessage,
            variant: "destructive",
          });
          
          throw new Error(errorMessage);
        }
        
        // Expose SCORM APIs to window BEFORE setting iframe src
        (window as any).API = scorm12API;
        (window as any).API_1484_11 = scorm2004API;
        
        addDebugLog('🚀 SCORM APIs exposed to window');
        addDebugLog(`👤 Learner: ${attemptStateRef.current['cmi.core.student_name']}`);
        addDebugLog(`🆔 Attempt ID: ${newAttemptId}`);
        
        // Set up 10-second timeout for SCORM initialization
        initTimeoutRef.current = setTimeout(() => {
          if (!scormInitialized) {
            console.warn('⚠️ SCORM API initialization timeout - SCO may not have called Initialize within 10 seconds');
            addDebugLog('⚠️ API timeout - SCO didn\'t initialize within 10s');
            setShowInitWarning(true);
          }
        }, 10000);
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('❌ Error initializing course:', error);
        addDebugLog(`❌ Initialization error: ${error.message || error}`);
        setIsLoading(false);
        
        // Show error in UI instead of just console
        if (!error.message?.includes('Launch Failed')) {
          toast({
            title: "Course Initialization Failed",
            description: error.message || "Failed to initialize course. Please try again.",
            variant: "destructive",
          });
        }
      }
    };
    
    initializeCourse();
    
    // Cleanup on unmount
    return () => {
      delete (window as any).API;
      delete (window as any).API_1484_11;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [assignmentId]);

  const handleComplete = async () => {
    const state = attemptStateRef.current;
    const score = state['cmi.core.score.raw'] || state['cmi.score.raw'];
    const status = state['cmi.core.lesson_status'] || state['cmi.completion_status'];
    
    if (status !== 'completed' && status !== 'passed') {
      toast({
        title: "Course Incomplete",
        description: "Please complete the course content first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Final commit of SCORM data
      await sendScormResult('finish');
      
      toast({
        title: "Course Completed!",
        description: score ? `Score: ${score}%` : "Course completed successfully",
      });
      
      onComplete();
    } catch (error) {
      console.error('Error completing course:', error);
      toast({
        title: "Error",
        description: "Failed to complete course",
        variant: "destructive",
      });
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl h-5/6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg" data-testid="text-course-title">{courseTitle}</h3>
          <div className="flex gap-2">
            <div className="badge badge-info" data-testid="text-course-progress">
              Progress: {progress}%
            </div>
            <button 
              className="btn btn-sm btn-circle"
              onClick={onClose}
              data-testid="button-close-player"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        {/* SCORM Player Area */}
        <div className="bg-base-300 rounded-lg h-full mb-4 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="loading loading-spinner loading-lg mb-4"></div>
                <h4 className="text-2xl font-bold mb-2">Loading SCORM Course...</h4>
                <p className="text-base-content/60">Initializing runtime environment</p>
              </div>
            </div>
          ) : scormUrl ? (
            <>
              {/* Initialization Warning */}
              {showInitWarning && (
                <div className="absolute top-0 left-0 right-0 z-10 bg-error text-error-content p-3 rounded-t-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span className="text-sm">
                      SCO didn't initialise. Check that the launch URL is correct and not blocked by headers. Current src: {scormUrl}
                    </span>
                  </div>
                  <button 
                    className="btn btn-xs btn-ghost"
                    onClick={() => setShowInitWarning(false)}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {/* SCORM Content Iframe */}
              <iframe
                ref={iframeRef}
                src={scormUrl}
                className={`w-full h-full rounded-lg border-0 ${showInitWarning ? 'mt-12' : ''}`}
                title={courseTitle}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                data-testid="iframe-scorm-content"
                onLoad={(e) => {
                  console.log(`✅ Iframe loaded: ${(e.target as HTMLIFrameElement).src}`);
                  addDebugLog(`🔄 Iframe loaded successfully`);
                }}
              />
              
              {/* Open in new tab button */}
              <button
                className="absolute bottom-2 left-2 btn btn-xs btn-ghost opacity-75 hover:opacity-100"
                onClick={() => window.open(scormUrl, '_blank', 'noopener,noreferrer')}
                title="Open launch URL in new tab"
                data-testid="button-open-new-tab"
              >
                <i className="fas fa-external-link-alt"></i>
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h4 className="text-2xl font-bold mb-2" data-testid="text-error-title">
                  Course Not Available
                </h4>
                <p className="text-base-content/60 mb-4" data-testid="text-error-description">
                  Unable to load SCORM content. Please contact support.
                </p>
              </div>
            </div>
          )}
          
          {/* Debug Panel Toggle */}
          <button
            className="absolute top-2 right-2 btn btn-xs btn-ghost opacity-50 hover:opacity-100"
            onClick={() => setShowDebug(!showDebug)}
            data-testid="button-toggle-debug"
          >
            <i className="fas fa-bug"></i>
          </button>
          
          {/* SCORM Debug Panel */}
          {showDebug && (
            <div className="absolute top-10 right-2 w-80 bg-base-100 border border-base-content/20 rounded-lg p-4 shadow-lg max-h-64 overflow-y-auto">
              <h5 className="font-bold text-sm mb-2">SCORM Debug Log</h5>
              <div className="text-xs space-y-1 font-mono">
                {debugLog.map((log, index) => (
                  <div key={index} className="text-base-content/70">
                    {log}
                  </div>
                ))}
              </div>
              <button
                className="btn btn-xs btn-ghost mt-2 w-full"
                onClick={() => setDebugLog([])}
                data-testid="button-clear-debug"
              >
                Clear Log
              </button>
            </div>
          )}
        </div>
        
        {/* Course Controls */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <div className="badge badge-outline text-xs">
              Attempt: {attemptId.split('_')[1] || 'N/A'}
            </div>
            <div className="badge badge-info text-xs">
              APIs: {typeof (window as any).API !== 'undefined' ? 'SCORM 1.2' : ''} 
              {typeof (window as any).API_1484_11 !== 'undefined' ? ' SCORM 2004' : ''}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-base-content/60">
              Status: {attemptStateRef.current['cmi.core.lesson_status'] || attemptStateRef.current['cmi.completion_status'] || 'Not Started'}
            </div>
            
            <progress 
              className="progress progress-primary w-64" 
              value={progress} 
              max="100"
              data-testid="progress-course"
            ></progress>
            
            <div className="text-sm font-mono">
              {progress}%
            </div>
          </div>
          
          <button 
            className={`btn btn-sm ${progress === 100 ? 'btn-success' : 'btn-primary'}`}
            onClick={handleComplete}
            data-testid="button-complete-course"
          >
            <i className="fas fa-check"></i> 
            {progress === 100 ? 'Complete' : 'Finish'}
          </button>
        </div>
      </div>
      
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
