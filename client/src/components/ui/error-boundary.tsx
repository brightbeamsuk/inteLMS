import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCcw, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
    
    // Call the optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error boundary UI
      const { error, errorInfo } = this.state;
      
      return (
        <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                {/* Error Icon */}
                <div className="flex justify-center mb-4">
                  <div className="bg-error/10 rounded-full p-3">
                    <AlertTriangle className="h-8 w-8 text-error" />
                  </div>
                </div>

                {/* Error Title */}
                <h2 className="card-title justify-center text-error mb-2">
                  Something went wrong
                </h2>

                {/* Error Description */}
                <p className="text-base-content/70 text-center mb-6">
                  The page encountered an unexpected error and couldn't render properly.
                  This has been logged for investigation.
                </p>

                {/* Error Details (collapsible in development) */}
                {process.env.NODE_ENV === 'development' && error && (
                  <div className="collapse collapse-arrow border border-base-300 bg-base-200 mb-6">
                    <input type="checkbox" />
                    <div className="collapse-title text-sm font-medium">
                      <Bug className="inline w-4 h-4 mr-2" />
                      Technical Details
                    </div>
                    <div className="collapse-content">
                      <div className="bg-base-300 rounded p-3">
                        <h4 className="font-semibold text-error mb-2">Error:</h4>
                        <pre className="text-xs text-error font-mono whitespace-pre-wrap mb-3">
                          {error.message}
                        </pre>
                        <h4 className="font-semibold text-error mb-2">Stack Trace:</h4>
                        <pre className="text-xs text-base-content/60 font-mono whitespace-pre-wrap mb-3">
                          {error.stack}
                        </pre>
                        {errorInfo && (
                          <>
                            <h4 className="font-semibold text-error mb-2">Component Stack:</h4>
                            <pre className="text-xs text-base-content/60 font-mono whitespace-pre-wrap">
                              {errorInfo.componentStack}
                            </pre>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="card-actions justify-center">
                  <button 
                    className="btn btn-primary"
                    onClick={this.handleRetry}
                    data-testid="button-retry"
                  >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </button>
                  <button 
                    className="btn btn-outline"
                    onClick={this.handleReload}
                    data-testid="button-reload"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={errorFallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;