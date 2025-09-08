import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoursePlayerProps {
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  onComplete: () => void;
  onClose: () => void;
  startFresh?: boolean;
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

export function CoursePlayer({ assignmentId, courseId, courseTitle, onComplete, onClose, startFresh = false }: CoursePlayerProps) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [scormUrl, setScormUrl] = useState<string>('');
  const [attemptId, setAttemptId] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [scormInitialized, setScormInitialized] = useState(false);
  const [showInitWarning, setShowInitWarning] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [hasCommittedData, setHasCommittedData] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Store current SCORM state for save functionality
  const currentScormStateRef = useRef({
    location: '',
    suspendData: '',
    progressMeasure: ''
  });
  
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
      // Improved SCORM version detection - prioritize 2004 if completion status fields are present
      const scormVersion = (state['cmi.completion_status'] !== undefined || state['cmi.success_status'] !== undefined) ? '2004' : '1.2';
      
      let payload: any = {
        learnerId: state['cmi.core.student_id'] || state['cmi.learner_id'],
        courseId: assignmentId,
        attemptId,
        standard: scormVersion,
        reason
      };
      
      if (scormVersion === '1.2') {
        // SCORM 1.2 required fields
        payload.scormData = {
          'cmi.core.lesson_status': state['cmi.core.lesson_status'] || 'incomplete',
          'cmi.core.score.raw': state['cmi.core.score.raw'] || '',
          'cmi.core.score.min': state['cmi.core.score.min'] || '0',
          'cmi.core.score.max': state['cmi.core.score.max'] || '100',
          'cmi.core.lesson_location': state['cmi.core.lesson_location'] || '',
          'cmi.suspend_data': state['cmi.suspend_data'] || '',
          'cmi.core.session_time': state['cmi.core.session_time'] || '00:00:00'
        };
      } else {
        // SCORM 2004 required fields
        payload.scormData = {
          'cmi.completion_status': state['cmi.completion_status'] || 'incomplete',
          'cmi.success_status': state['cmi.success_status'] || 'unknown',
          'cmi.score.raw': state['cmi.score.raw'] || '',
          'cmi.score.scaled': state['cmi.score.scaled'] || '',
          'cmi.progress_measure': state['cmi.progress_measure'] || '',
          'cmi.location': state['cmi.location'] || '',
          'cmi.suspend_data': state['cmi.suspend_data'] || '',
          'cmi.session_time': state['cmi.session_time'] || 'PT0H0M0S'
        };
      }
      
      console.log(`📊 SCORM ${scormVersion} complete payload:`, payload);
      
      const response = await apiRequest('POST', '/api/scorm/result', payload);
      const result = await response.json();
      
      // Track that we've successfully committed data during this session
      if (reason === 'commit') {
        setHasCommittedData(true);
      }
      
      console.log(`✅ SCORM result response:`, result);
      
      // Log derived fields if available
      if (result.derivedFields) {
        console.log(`📈 Derived fields: progressPercent=${result.derivedFields.progressPercent}%, passed=${result.derivedFields.passed}, completed=${result.derivedFields.completed}`);
        
        // Update the progress bar with the accurate backend calculation
        if (typeof result.derivedFields.progressPercent === 'number') {
          console.log(`🎯 Updating progress bar from ${progress}% to ${result.derivedFields.progressPercent}%`);
          setProgress(result.derivedFields.progressPercent);
          addDebugLog(`📊 Progress updated: ${progress}% → ${result.derivedFields.progressPercent}%`);
        }
        
        // Update completion status based on backend calculation
        if (result.derivedFields.completed !== undefined) {
          setIsCompleted(result.derivedFields.completed);
        }
      }
      
      addDebugLog(`✅ SCORM result sent (${reason}): ${JSON.stringify({
        score: payload.scormData['cmi.core.score.raw'] || payload.scormData['cmi.score.raw'],
        status: payload.scormData['cmi.core.lesson_status'] || payload.scormData['cmi.completion_status'],
        location: payload.scormData['cmi.core.lesson_location'] || payload.scormData['cmi.location'],
        suspendData: payload.scormData['cmi.suspend_data'] ? 'present' : 'empty'
      })}`);
      
      if (result.derivedFields) {
        addDebugLog(`📈 Progress: ${result.derivedFields.progressPercent}% | Passed: ${result.derivedFields.passed} | Completed: ${result.derivedFields.completed}`);
      }
    } catch (error) {
      console.error('Failed to send SCORM result:', error);
      addDebugLog(`❌ Failed to send SCORM result: ${error}`);
    }
  };

  // Exit modal handlers for SCORM 2004 (3rd Ed.) requirements
  const handleExitRequest = () => {
    setShowExitModal(true);
  };

  const handleSaveAndExit = async () => {
    console.log('💾 Save & resume later clicked');
    console.log(`📚 Course ID: ${courseId}`);
    console.log(`🎯 Attempt ID: ${attemptId}`);
    
    try {
      const api = (window as any).API_1484_11;
      
      // Use captured SCORM data from SetValue interception (critical for data preservation)
      const location = currentScormStateRef.current.location;
      const suspendData = currentScormStateRef.current.suspendData;
      const progressMeasure = currentScormStateRef.current.progressMeasure;
      
      console.log('📊 SCORM data captured from SetValue interception:', {
        location: location || 'none',
        suspendData: suspendData ? `${suspendData.length} chars` : 'none',
        progressMeasure: progressMeasure || '0'
      });
      
      // Set exit mode to "suspend" before committing
      try {
        api?.SetValue('cmi.exit', 'suspend');
        console.log('🔄 Set cmi.exit = "suspend" for save & resume');
      } catch {}
      
      // Commit the data including the exit mode
      try { 
        api?.Commit(""); 
      } catch {}
      
      console.log('📊 SCORM data to save:', {
        location: location || 'none',
        suspendData: suspendData ? 'present' : 'none',
        progressMeasure: progressMeasure || '0'
      });

      // Calculate progress percentage
      const progressPct = progressMeasure ? Math.round(parseFloat(progressMeasure) * 100) : 0;

      // Call the save endpoint according to specification
      console.log('📤 Calling /api/lms/attempt/save');
      const response = await apiRequest('POST', '/api/lms/attempt/save', {
        courseId: courseId,
        attemptId: attemptId,
        location: location,
        suspendData: suspendData,
        progressPct: progressPct
      });

      if (response?.ok) {
        const result = await response.json();
        console.log('✅ Save response:', result);
        
        // Check new specification-compliant response format
        if (result?.status === 'IN_PROGRESS' && result?.attemptId) {
          // Store in localStorage as fallback (per specification)
          const saveData = {
            attemptId: result.attemptId,
            lastLocation: result.lastLocation || location,
            suspendData: result.suspendData || suspendData,
            progressPct: result.progressPct || progressPct,
            courseId: courseId,
            timestamp: Date.now()
          };
          localStorage.setItem(`scorm_save_${courseId}`, JSON.stringify(saveData));
          console.log('💾 Saved to localStorage as fallback:', saveData);
          
          // Update dashboard without page refresh (per specification)
          window.parent?.postMessage({ 
            type: 'ATTEMPT_UPDATED', 
            courseId: courseId,
            status: 'IN_PROGRESS',
            progressPct: result.progressPct || progressPct
          }, '*');
          
          toast({
            title: "Progress saved",
            description: "You can resume later.",
          });
          setShowExitModal(false);
          onClose();
        } else {
          console.error('❌ Save failed - invalid response format:', result);
          toast({
            title: "Save failed", 
            description: "Could not save progress. Please try again.",
            variant: "destructive"
          });
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Save failed:', errorText);
        
        // Save locally on server failure (per specification)
        const localSaveData = {
          attemptId: attemptId,
          lastLocation: location,
          suspendData: suspendData,
          progressPct: progressPct,
          courseId: courseId,
          timestamp: Date.now()
        };
        localStorage.setItem(`scorm_save_${courseId}`, JSON.stringify(localSaveData));
        
        toast({
          title: "Couldn't save to server",
          description: "Saved locally, you can still resume.",
          variant: "default"
        });
        setShowExitModal(false);
        onClose();
      }
    } catch (error) {
      console.error('❌ Failed to save progress:', error);
      toast({
        title: "Save failed",
        description: "Could not save progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDontSaveExit = async () => {
    try {
      if (!hasCommittedData) {
        // No commits happened - revert assignment to "not_started"
        await apiRequest('POST', `/api/assignments/${assignmentId}/reset-status`);
        toast({
          title: "Progress discarded",
          description: "Course has been reset to Not Started.",
        });
      } else {
        // Commits already exist - keep "In Progress" to avoid losing saved progress
        toast({
          title: "Progress preserved",
          description: "Your saved progress has been kept.",
        });
      }
      setShowExitModal(false);
      onClose();
    } catch (error) {
      console.error('Failed to handle exit:', error);
      // Still allow exit even if status update fails
      setShowExitModal(false);
      onClose();
    }
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
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
      
      // Immediately commit critical status changes for real-time progress updates
      if (element === 'cmi.core.lesson_status' && (value === 'completed' || value === 'passed' || value === 'failed')) {
        console.log(`🎯 Critical status change: ${element} = ${value}, auto-committing`);
        sendScormResult('commit');
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
      
      // If already initialized, just return
      if (scormInitialized) {
        return "true";
      }
      
      // SCORM model should already be hydrated from the attempt data
      // that was loaded when the course launched
      
      // Set required SCORM 2004 fields if not already set
      if (!attemptStateRef.current['cmi.entry']) {
        attemptStateRef.current['cmi.entry'] = 'ab-initio';
      }
      if (!attemptStateRef.current['cmi.mode']) {
        attemptStateRef.current['cmi.mode'] = 'normal';
      }
      if (!attemptStateRef.current['cmi.credit']) {
        attemptStateRef.current['cmi.credit'] = 'credit';
      }
      
      console.log(`📖 SCORM Initialize complete - entry mode: ${attemptStateRef.current['cmi.entry']}`);
      addDebugLog(`✅ SCORM model ready - entry: ${attemptStateRef.current['cmi.entry']}, location: ${attemptStateRef.current['cmi.location']}, suspend_data: ${attemptStateRef.current['cmi.suspend_data'] ? 'present' : 'empty'}`);
      
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
      
      // Immediately commit critical status changes for real-time progress updates
      if ((element === 'cmi.completion_status' && value === 'completed') ||
          (element === 'cmi.success_status' && (value === 'passed' || value === 'failed')) ||
          (element === 'cmi.progress_measure' && parseFloat(value) >= 1.0)) {
        console.log(`🎯 Critical status change: ${element} = ${value}, auto-committing`);
        sendScormResult('commit');
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
        const userRes = await apiRequest('GET', '/api/auth/user');
        const userResponse = await userRes.json();
        attemptStateRef.current['cmi.core.student_id'] = userResponse.id;
        attemptStateRef.current['cmi.core.student_name'] = `${userResponse.firstName || ''} ${userResponse.lastName || ''}`.trim();
        attemptStateRef.current['cmi.learner_id'] = userResponse.id;
        attemptStateRef.current['cmi.learner_name'] = `${userResponse.firstName || ''} ${userResponse.lastName || ''}`.trim();
        
        // SCORM 2004 (3rd Ed.) - Start attempt and load saved data BEFORE SCORM initialization
        console.log(`🚀 Starting SCORM attempt for course: ${courseId}`);
        
        let resumeData = null;
        let useServerData = false;
        
        // 1) Skip saved data check if starting fresh
        if (startFresh) {
          console.log(`🆕 Starting fresh - skipping saved data check`);
        } else {
          // Try to get latest attempt from server first (per specification)
          try {
            console.log(`📤 Checking for latest attempt: /api/lms/attempt/latest?courseId=${courseId}`);
            const latestRes = await apiRequest('GET', `/api/lms/attempt/latest?courseId=${courseId}`);
            
            if (latestRes.ok) {
              const latestResult = await latestRes.json();
              console.log(`📦 Latest attempt result:`, latestResult);
              
              if (latestResult.success && latestResult.attempt) {
                const attempt = latestResult.attempt;
                if (attempt.status === 'IN_PROGRESS' && (attempt.lastLocation || attempt.suspendData)) {
                  resumeData = {
                    attemptId: attempt.attemptId,
                    lastLocation: attempt.lastLocation,
                    suspendData: attempt.suspendData,
                    progressPct: attempt.progressPct,
                    timestamp: new Date(attempt.updatedAt).getTime()
                  };
                  useServerData = true;
                  console.log(`🌐 Using server resume data:`, resumeData);
                }
              }
            }
          } catch (latestError) {
            console.log(`⚠️ Server latest attempt failed, will check localStorage:`, latestError?.message);
          }
          
          // 2) Check localStorage fallback if no server data (per specification)
          if (!resumeData) {
            try {
              const localSave = localStorage.getItem(`scorm_save_${courseId}`);
              if (localSave) {
                const localData = JSON.parse(localSave);
                console.log(`💾 Found localStorage save data:`, localData);
                
                // Use local data as fallback
                resumeData = localData;
                console.log(`📱 Using localStorage fallback:`, resumeData);
              }
            } catch (localError) {
              console.log(`⚠️ localStorage check failed:`, localError);
            }
          }
        }
        
        // 3) Start or create attempt
        try {
          console.log(`📤 Making request to /api/lms/attempt/start with courseId: ${courseId}`);
          const attemptStartRes = await apiRequest('POST', '/api/lms/attempt/start', {
            courseId: courseId
          });
          
          if (attemptStartRes.ok) {
            const attemptResult = await attemptStartRes.json();
            console.log(`📦 Attempt start result:`, attemptResult);
            
            if (attemptResult.attemptId) {
              // Store attemptId in memory and localStorage (per specification)
              setAttemptId(attemptResult.attemptId);
              localStorage.setItem(`scorm_attemptId_${courseId}`, attemptResult.attemptId);
              
              console.log(`✅ SCORM attempt ready: ${attemptResult.attemptId}, status: ${attemptResult.status}`);
              addDebugLog(`✅ Attempt ready: ${attemptResult.attemptId} (${attemptResult.status})`);
              
              // 4) Apply resume data if available (prefer server over local)
              const dataToUse = useServerData ? resumeData : (resumeData || {});
              
              if (dataToUse.lastLocation || dataToUse.suspendData) {
                console.log(`🔄 Resuming with saved data: location="${dataToUse.lastLocation}", suspend_data="${dataToUse.suspendData}"`);
                addDebugLog(`🔄 Resuming at saved position: ${dataToUse.lastLocation || 'start'}`);
                
                // Update SCORM state with saved values BEFORE the course initializes
                attemptStateRef.current = {
                  ...attemptStateRef.current,
                  'cmi.core.lesson_location': dataToUse.lastLocation || '',
                  'cmi.location': dataToUse.lastLocation || '',
                  'cmi.suspend_data': dataToUse.suspendData || '',
                  // Set entry mode for resume
                  'cmi.entry': dataToUse.suspendData ? 'resume' : 'ab-initio'
                };
                
                console.log(`🎯 SCORM state hydrated with entry mode: ${dataToUse.suspendData ? 'resume' : 'ab-initio'}`);
              } else {
                console.log(`🆕 New attempt - no saved data to restore`);
                attemptStateRef.current['cmi.entry'] = 'ab-initio';
              }
            } else {
              console.log('📄 Invalid attempt result, using generated attempt ID:', newAttemptId);
              setAttemptId(newAttemptId);
            }
          } else {
            const errorText = await attemptStartRes.text();
            console.error(`❌ Attempt start failed with status ${attemptStartRes.status}:`, errorText);
            console.log('📄 Using generated attempt ID:', newAttemptId);
            setAttemptId(newAttemptId);
          }
        } catch (attemptError) {
          console.error('⚠️ Failed to start attempt, using generated ID:', attemptError?.message || attemptError);
          addDebugLog(`⚠️ Failed to start attempt: ${attemptError?.message || 'Unknown error'}`);
          setAttemptId(newAttemptId);
          
          // Apply local data if server failed
          if (resumeData?.lastLocation || resumeData?.suspendData) {
            console.log(`📱 Applying localStorage data due to server failure`);
            attemptStateRef.current = {
              ...attemptStateRef.current,
              'cmi.core.lesson_location': resumeData.lastLocation || '',
              'cmi.location': resumeData.lastLocation || '',
              'cmi.suspend_data': resumeData.suspendData || '',
              'cmi.entry': resumeData.suspendData ? 'resume' : 'ab-initio'
            };
          }
        }
        
        // Get course launch URL using improved SCORM processing
        try {
          console.log(`🚀 Requesting launch data for assignment: ${assignmentId}`);
          const response = await apiRequest('GET', `/api/scorm/${assignmentId}/launch`);
          const launchResponse = await response.json();
          console.log('✅ Launch data received:', launchResponse);
          console.log('🚀 Launch response type:', typeof launchResponse);
          console.log('🚀 Launch response keys:', Object.keys(launchResponse || {}));
          
          // Check if response is valid
          if (!launchResponse || typeof launchResponse !== 'object') {
            throw new Error('Invalid launch response received from server');
          }
          
          // Use launch URL override if available, otherwise use parsed URL
          const finalLaunchUrl = launchResponse.launchUrlOverride || launchResponse.launchUrl;
          
          if (!finalLaunchUrl) {
            console.error('❌ No launch URL found in response:', launchResponse);
            throw new Error('No launch URL provided by server');
          }
          
          // Log launch URL before setting iframe
          console.log(`🎯 Launch URL set: ${finalLaunchUrl}`);
          console.log(`📋 SCORM Version: ${launchResponse.scormVersion || 'unknown'}`);
          console.log(`📖 Course Title: ${launchResponse.courseTitle || 'unknown'}`);
          
          if (launchResponse.diagnostics) {
            console.log('🔍 SCORM Diagnostics:', launchResponse.diagnostics);
            addDebugLog(`📊 Diagnostics: ${JSON.stringify(launchResponse.diagnostics, null, 2)}`);
          }
          
          setScormUrl(finalLaunchUrl);
          addDebugLog(`🎯 Launch URL set: ${finalLaunchUrl}`);
          addDebugLog(`📋 SCORM Version: ${launchResponse.scormVersion || 'unknown'}`);
          addDebugLog(`📖 Course: ${launchResponse.courseTitle || 'unknown'}`);
        } catch (launchError: any) {
          console.error('❌ SCORM launch failed:', launchError);
          console.error('❌ Error details:', {
            message: launchError.message,
            status: launchError.status,
            response: launchError.response
          });
          
          // Handle specific SCORM errors with user-friendly messages
          let errorMessage = 'Failed to launch course. Please contact support.';
          
          if (launchError.message?.includes('Unauthorized') || launchError.status === 401) {
            errorMessage = 'You are not authorized to access this course. Please log in again.';
          } else if (launchError.message?.includes('Invalid launch response')) {
            errorMessage = 'Server returned invalid launch data. Please try refreshing the page.';
          } else if (launchError.message?.includes('No launch URL provided')) {
            errorMessage = 'Course launch URL not available. The SCORM package may not be properly configured.';
          } else if (launchError.message?.includes('LAUNCH_FILE_NOT_FOUND')) {
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
        
        // Add SCORM Logger to capture all API calls for debugging
        const wrapApiForLogging = (api: any, version: string) => {
          const methodNames = ['Initialize', 'LMSInitialize', 'GetValue', 'LMSGetValue', 'SetValue', 'LMSSetValue', 
                              'Commit', 'LMSCommit', 'Terminate', 'LMSTerminate', 'GetLastError', 'LMSGetLastError', 
                              'GetErrorString', 'LMSGetErrorString', 'GetDiagnostic', 'LMSGetDiagnostic'];
          
          methodNames.forEach(method => {
            if (typeof api[method] === 'function') {
              const originalMethod = api[method].bind(api);
              api[method] = function(...args: any[]) {
                const result = originalMethod.apply(this, args);
                
                // Capture current state when course sets location or suspend_data
                if (method === 'SetValue' || method === 'LMSSetValue') {
                  const [field, value] = args;
                  
                  if (field === 'cmi.location' || field === 'cmi.core.lesson_location') {
                    currentScormStateRef.current.location = value || '';
                  } else if (field === 'cmi.suspend_data') {
                    currentScormStateRef.current.suspendData = value || '';
                  } else if (field === 'cmi.progress_measure') {
                    currentScormStateRef.current.progressMeasure = value || '';
                  }
                }
                
                // Log the call
                const logEntry = {
                  timestamp: Date.now(),
                  scormVersion: version,
                  function: method,
                  arguments: Array.from(args),
                  result: result,
                  assignmentId: assignmentId,
                  attemptId: attemptId
                };
                
                console.debug(`[SCORM ${version}]`, method, args, '=>', result);
                
                // Send to server for detailed analysis
                fetch('/api/scorm/log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(logEntry)
                }).catch(e => console.warn('SCORM log send failed:', e));
                
                return result;
              };
            }
          });
        };
        
        // Wrap both APIs with logging
        wrapApiForLogging((window as any).API, '1.2');
        wrapApiForLogging((window as any).API_1484_11, '2004');
        
        addDebugLog('🚀 SCORM APIs exposed to window with logging enabled');
        addDebugLog(`👤 Learner: ${attemptStateRef.current['cmi.core.student_name']}`);
        addDebugLog(`🆔 Attempt ID: ${newAttemptId}`);
        
        // Expose debugging functions to browser console for live SCORM inspection
        (window as any).scormDebug = {
          // Get all current SCORM data
          getData: () => {
            console.log('📊 Current SCORM Data State:', attemptStateRef.current);
            return attemptStateRef.current;
          },
          
          // Get specific SCORM field
          getField: (field: string) => {
            const value = attemptStateRef.current[field];
            console.log(`📋 SCORM Field "${field}":`, value);
            return value;
          },
          
          // Set SCORM field (for testing)
          setField: (field: string, value: string) => {
            console.log(`🔧 Setting SCORM field "${field}" = "${value}"`);
            const api = scormUrl?.includes('2004') ? (window as any).API_1484_11 : (window as any).API;
            if (api && api.SetValue) {
              api.SetValue(field, value);
              console.log('✅ Field set successfully');
            } else {
              console.error('❌ SCORM API not available');
            }
          },
          
          // Force progress calculation
          calculateProgress: () => {
            console.log('📊 Triggering progress calculation...');
            sendScormResult('commit');
          },
          
          // Show progress details
          showProgress: () => {
            console.log(`📈 Current Progress: ${progress}%`);
            console.log('📊 Detailed Progress Analysis:');
            const standard = scormUrl?.includes('2004') ? '2004' : '1.2';
            
            if (standard === '2004') {
              console.log(`   completion_status: "${attemptStateRef.current['cmi.completion_status']}"`);
              console.log(`   success_status: "${attemptStateRef.current['cmi.success_status']}"`);
              console.log(`   progress_measure: "${attemptStateRef.current['cmi.progress_measure']}"`);
            } else {
              console.log(`   lesson_status: "${attemptStateRef.current['cmi.core.lesson_status']}"`);
              console.log(`   suspend_data length: ${(attemptStateRef.current['cmi.suspend_data'] || '').length} chars`);
            }
          },
          
          // Simulate course completion (for testing)
          markComplete: () => {
            console.log('🎯 Simulating course completion...');
            const standard = scormUrl?.includes('2004') ? '2004' : '1.2';
            if (standard === '2004') {
              (window as any).scormDebug.setField('cmi.completion_status', 'completed');
              (window as any).scormDebug.setField('cmi.success_status', 'passed');
              (window as any).scormDebug.setField('cmi.progress_measure', '1.0');
            } else {
              (window as any).scormDebug.setField('cmi.core.lesson_status', 'completed');
            }
            (window as any).scormDebug.calculateProgress();
          },
          
          // Export current state for analysis
          export: () => {
            const exportData = {
              timestamp: new Date().toISOString(),
              attemptId: attemptId,
              assignmentId: assignmentId,
              standard: scormUrl?.includes('2004') ? '2004' : '1.2',
              progress: progress,
              scormData: {...attemptStateRef.current}
            };
            console.log('💾 Export Data:', exportData);
            
            // Create downloadable file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scorm-debug-${attemptId}-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return exportData;
          },
          
          // Show help for debugging functions
          help: () => {
            console.log(`
🔧 SCORM Debug Console Functions:
  
📊 Data Inspection:
  scormDebug.getData()           - Show all SCORM data
  scormDebug.getField(field)     - Get specific field value
  scormDebug.showProgress()      - Show progress analysis
  
🛠️ Data Manipulation (for testing):
  scormDebug.setField(field, value) - Set SCORM field value
  scormDebug.markComplete()      - Simulate completion
  scormDebug.calculateProgress() - Force progress calculation
  
💾 Export & Analysis:
  scormDebug.export()            - Download current state as JSON
  scormDebug.help()              - Show this help
  
📋 Examples:
  scormDebug.getField('cmi.core.lesson_status')  
  scormDebug.setField('cmi.core.score.raw', '85')
  scormDebug.showProgress()
            `);
          }
        };
        
        // Show console message about debugging tools
        console.log('🔧 SCORM Debug Tools Available! Use scormDebug.help() for commands.');
        addDebugLog('🔧 Debug tools: scormDebug.help() in console');
        
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

  // Track if course is completed based on SCORM status
  const [isCompleted, setIsCompleted] = useState(false);

  // Monitor SCORM state changes to update completion status
  useEffect(() => {
    const checkCompletion = () => {
      const state = attemptStateRef.current;
      
      // Check SCORM 2004 completion (prioritize)
      const completionStatus = state['cmi.completion_status'];
      const successStatus = state['cmi.success_status'];
      
      // Check SCORM 1.2 completion (fallback)
      const lessonStatus = state['cmi.core.lesson_status'];
      
      // Determine if course is complete based on SCORM standards
      let courseComplete = false;
      
      if (completionStatus !== undefined || successStatus !== undefined) {
        // SCORM 2004: Check completion_status OR success_status
        courseComplete = (completionStatus === 'completed') || (successStatus === 'passed');
      } else if (lessonStatus !== undefined) {
        // SCORM 1.2: Check lesson_status
        courseComplete = (lessonStatus === 'completed') || (lessonStatus === 'passed');
      }
      
      if (courseComplete !== isCompleted) {
        setIsCompleted(courseComplete);
        if (courseComplete) {
          console.log('🎯 Course completion detected - enabling finish button');
        }
      }
    };

    // Check completion initially and set up periodic checks
    checkCompletion();
    const interval = setInterval(checkCompletion, 1000); // Check every second
    
    return () => clearInterval(interval);
  }, [isCompleted]);

  // Add beforeunload listener for SCORM 2004 (3rd Ed.) exit modal
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (scormInitialized) {
        e.preventDefault();
        e.returnValue = '';
        // Show exit modal when user tries to leave
        setShowExitModal(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [scormInitialized]);

  const handleComplete = async () => {
    const state = attemptStateRef.current;
    const score = state['cmi.core.score.raw'] || state['cmi.score.raw'];
    
    // Force a final SCORM commit and terminate before finishing
    try {
      console.log('🎯 Finishing course - forcing final SCORM commit...');
      
      let scormSnapshot = { version: 'none' };
      
      // Force final commit for both SCORM versions and capture snapshot
      if (typeof (window as any).API_1484_11 !== 'undefined') {
        const api = (window as any).API_1484_11;
        try {
          api.Commit('');
          console.log('📊 SCORM 2004: Final commit completed');
          
          // Capture SCORM 2004 snapshot
          scormSnapshot = {
            version: '2004',
            completion_status: api.GetValue('cmi.completion_status') || 'unknown',
            success_status: api.GetValue('cmi.success_status') || 'unknown',
            score_raw: api.GetValue('cmi.score.raw') || '',
            progress_measure: api.GetValue('cmi.progress_measure') || ''
          };
        } catch (e) {
          console.warn('SCORM 2004 commit warning:', e);
        }
        
        try {
          api.Terminate('');
          console.log('📊 SCORM 2004: Terminated successfully');
        } catch (e) {
          console.warn('SCORM 2004 terminate warning:', e);
        }
      } else if (typeof (window as any).API !== 'undefined') {
        const api = (window as any).API;
        try {
          api.LMSCommit('');
          console.log('📊 SCORM 1.2: Final commit completed');
          
          // Capture SCORM 1.2 snapshot
          scormSnapshot = {
            version: '1.2',
            lesson_status: api.LMSGetValue('cmi.core.lesson_status') || 'not attempted',
            score_raw: api.LMSGetValue('cmi.core.score.raw') || '',
            lesson_location: api.LMSGetValue('cmi.core.lesson_location') || ''
          };
        } catch (e) {
          console.warn('SCORM 1.2 commit warning:', e);
        }
        
        try {
          api.LMSFinish('');
          console.log('📊 SCORM 1.2: Finished successfully');
        } catch (e) {
          console.warn('SCORM 1.2 finish warning:', e);
        }
      }

      // Determine completion status
      const isComplete = scormSnapshot.version === '2004' 
        ? (scormSnapshot.completion_status === 'completed' || scormSnapshot.success_status === 'passed')
        : (scormSnapshot.lesson_status === 'completed' || scormSnapshot.lesson_status === 'passed');

      const progressPercent = scormSnapshot.version === '2004' && scormSnapshot.progress_measure 
        ? Math.round(Math.max(0, Math.min(1, parseFloat(scormSnapshot.progress_measure))) * 100)
        : (isComplete ? 100 : 0);

      console.log('🏁 Sending finish request with snapshot:', { 
        snapshot: scormSnapshot, 
        complete: isComplete, 
        progress: progressPercent 
      });

      // Call the idempotent finish endpoint
      const response = await fetch('/lms/attempt/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          snapshot: scormSnapshot,
          complete: isComplete,
          progress: progressPercent
        })
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Course Completed!",
          description: score ? `Score: ${score}%` : "Course completed successfully",
        });
        
        // Close the course player
        onComplete();
      } else {
        // Show server message but allow retry
        toast({
          title: "Course Completion",
          description: result.message || 'Could not finalize the attempt. Please try again.',
          variant: result.message?.includes('not reported completion') ? 'default' : 'destructive',
        });
      }
      
    } catch (error) {
      console.error('❌ Error finishing course:', error);
      toast({
        title: "Network Error",
        description: "Failed to complete course due to network error. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl h-5/6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg" data-testid="text-course-title">{courseTitle}</h3>
          <div className="flex gap-2">
            <button 
              className="btn btn-sm btn-circle"
              onClick={handleExitRequest}
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
          </div>
          
          <button 
            className={`btn btn-sm ${isCompleted ? 'btn-success' : 'btn-primary btn-disabled'}`}
            onClick={handleComplete}
            disabled={!isCompleted}
            data-testid="button-complete-course"
          >
            <i className="fas fa-check"></i> 
            {isCompleted ? 'Complete' : 'Finish'}
          </button>
        </div>
      </div>
      
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleExitRequest}>close</button>
      </form>
    </dialog>

    {/* Exit Modal for SCORM 2004 (3rd Ed.) Save & Resume */}
    {showExitModal && (
      <div className="modal modal-open">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Save your progress?</h3>
          <p className="text-base-content/80 mb-6">
            You're about to exit the course. What would you like to do with your progress?
          </p>
          
          <div className="modal-action flex gap-3">
            <button 
              className="btn btn-primary"
              onClick={handleSaveAndExit}
              data-testid="button-save-exit"
            >
              <i className="fas fa-save"></i>
              Save & resume later
            </button>
            
            <button 
              className="btn btn-outline btn-error"
              onClick={handleDontSaveExit}
              data-testid="button-discard-exit"
            >
              <i className="fas fa-trash"></i>
              Don't save
            </button>
            
            <button 
              className="btn btn-ghost"
              onClick={handleCancelExit}
              data-testid="button-cancel-exit"
            >
              Continue course
            </button>
          </div>
        </div>
        
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCancelExit}>close</button>
        </form>
      </div>
    )}
    </>
  );
}
