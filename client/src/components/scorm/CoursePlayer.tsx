import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoursePlayerProps {
  assignmentId: string;
  courseTitle: string;
  onComplete: () => void;
  onClose: () => void;
}

export function CoursePlayer({ assignmentId, courseTitle, onComplete, onClose }: CoursePlayerProps) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate SCORM package loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleSimulateProgress = () => {
    const newProgress = Math.min(progress + 25, 100);
    setProgress(newProgress);
    
    toast({
      title: "Progress Saved",
      description: `Course progress: ${newProgress}%`,
    });
  };

  const handlePause = () => {
    toast({
      title: "Course Paused",
      description: "Your progress has been saved",
    });
  };

  const handleComplete = async () => {
    if (progress < 100) {
      toast({
        title: "Course Incomplete",
        description: "Please complete all sections before finishing",
        variant: "destructive",
      });
      return;
    }

    try {
      const scormData = {
        score: Math.floor(Math.random() * 30) + 70, // Random score between 70-100
        timeSpent: 45,
        sessionData: { progress: 100, completed: true }
      };

      await apiRequest('POST', `/api/scorm/${assignmentId}/complete`, scormData);
      
      toast({
        title: "Course Completed!",
        description: "Certificate has been generated",
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
        <div className="bg-base-300 rounded-lg h-full flex items-center justify-center mb-4">
          {isLoading ? (
            <div className="text-center">
              <div className="loading loading-spinner loading-lg mb-4"></div>
              <h4 className="text-2xl font-bold mb-2">Loading Course...</h4>
              <p className="text-base-content/60">Please wait while the SCORM package loads</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-4">📚</div>
              <h4 className="text-2xl font-bold mb-2" data-testid="text-player-title">
                SCORM Course Player
              </h4>
              <p className="text-base-content/60 mb-4" data-testid="text-player-description">
                Interactive course content would load here
              </p>
              <div className="flex gap-2 justify-center">
                <button 
                  className="btn btn-primary"
                  onClick={handleSimulateProgress}
                  data-testid="button-continue-learning"
                >
                  <i className="fas fa-play"></i> Continue Learning
                </button>
                <button 
                  className="btn btn-ghost"
                  onClick={handlePause}
                  data-testid="button-pause-course"
                >
                  <i className="fas fa-pause"></i> Pause
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Course Controls */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button 
              className="btn btn-sm btn-ghost"
              data-testid="button-previous"
            >
              <i className="fas fa-backward"></i> Previous
            </button>
            <button 
              className="btn btn-sm btn-ghost"
              data-testid="button-next"
            >
              <i className="fas fa-forward"></i> Next
            </button>
          </div>
          
          <progress 
            className="progress progress-primary w-64" 
            value={progress} 
            max="100"
            data-testid="progress-course"
          ></progress>
          
          <button 
            className={`btn btn-sm ${progress === 100 ? 'btn-success' : 'btn-disabled'}`}
            onClick={handleComplete}
            disabled={progress < 100}
            data-testid="button-complete-course"
          >
            <i className="fas fa-check"></i> Complete
          </button>
        </div>
      </div>
      
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
