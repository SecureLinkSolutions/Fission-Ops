import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: '40px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ background: '#161b22', border: '1px solid #f8514944', borderRadius: '8px', padding: '24px' }}>
            <div style={{ color: '#f85149', fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>
              Something went wrong
            </div>
            <div style={{ color: '#8b949e', fontSize: '13px', marginBottom: '16px' }}>
              {this.state.error.message}
            </div>
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ color: '#484f58', fontSize: '12px', cursor: 'pointer' }}>Stack trace</summary>
              <pre style={{ color: '#484f58', fontSize: '11px', marginTop: '8px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {this.state.error.stack}
              </pre>
            </details>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ background: '#238636', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
