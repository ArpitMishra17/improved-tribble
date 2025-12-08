import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, ExternalLink } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Something went wrong
            </h1>

            <p className="text-slate-600 mb-6">
              An unexpected error occurred. Please try refreshing the page or return to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-4 bg-slate-100 rounded-md text-left overflow-auto max-h-40">
                <p className="text-sm font-mono text-red-600 break-all">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-xs text-slate-500 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 items-center">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
                <Button
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
              <a
                href="https://github.com/anthropics/claude-code/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Report an issue
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
