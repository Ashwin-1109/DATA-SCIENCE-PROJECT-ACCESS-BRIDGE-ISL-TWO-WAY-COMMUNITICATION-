import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn(
      `[ErrorBoundary] Caught error in ${this.props.componentName || 'component'}:`,
      error,
      errorInfo
    );
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, showDetails: false });
    this.props.onReset?.();
  };

  toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Component temporarily unavailable';
      const message =
        this.props.fallbackMessage ||
        'This module encountered an unexpected issue. You can try reloading it, or continue using other AccessBridge tools.';

      return (
        <div 
          role="alert" 
          aria-live="polite"
          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 my-4 max-w-xl mx-auto shadow-xl"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="min-h-[42px] px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Try again</span>
            </button>

            <button
              onClick={this.toggleDetails}
              className="min-h-[42px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <span>Diagnostics</span>
              {this.state.showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {this.state.showDetails && (
            <div className="mt-4 p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-left font-mono text-[11px] text-slate-400 overflow-x-auto space-y-1">
              <div className="text-amber-400 font-semibold">Diagnostic Report:</div>
              <div>Module: {this.props.componentName || 'Unknown Component'}</div>
              <div>Status: Caught gracefully without crash</div>
              <div>Type: {this.state.error?.name || 'Error'}</div>
              <div className="text-slate-500 truncate">
                Message: {this.state.error?.message || 'Recoverable error'}
              </div>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
