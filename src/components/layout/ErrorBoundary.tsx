import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Antimatter UI:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="overlay" style={{ background: '#0a0b0f', color: '#e8eaed', zIndex: 999 }}>
          <div className="modal" style={{ padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
            <div className="brand-mark" style={{ margin: '0 auto 20px', width: '48px', height: '48px', fontSize: '24px' }}>A</div>
            <h1 style={{ fontSize: '20px', marginBottom: '12px' }}>Critical UI Error</h1>
            <p style={{ opacity: 0.7, marginBottom: '24px', fontSize: '13px' }}>
              Something went wrong while rendering the application shell. This might be due to a layout calculation failure or state corruption.
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '4px', textAlign: 'left', marginBottom: '24px', fontSize: '11px', fontFamily: 'monospace', overflow: 'auto', maxHeight: '200px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#ff6b6b', fontWeight: 'bold', marginBottom: '8px' }}>{this.state.error?.name}: {this.state.error?.message}</div>
              {this.state.error?.stack && (
                <div style={{ margin: '8px 0', padding: '8px', background: 'rgba(255,100,100,0.1)', borderLeft: '3px solid #ff6b6b', whiteSpace: 'pre-wrap', color: '#ff8a8a' }}>
                  {this.state.error.stack}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', opacity: 0.8, marginTop: '8px' }}>
                <strong>Component Stack:</strong>
                {this.state.errorInfo?.componentStack}
              </div>
            </div>
            <button 
              className="button primary large" 
              style={{ width: '100%' }}
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
