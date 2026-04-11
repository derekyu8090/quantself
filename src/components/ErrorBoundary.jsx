import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[${this.props.name || 'Panel'}] Error:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>!</div>
          <p style={{ color: 'var(--text-heading)', fontWeight: 600, marginBottom: '8px' }}>
            {this.props.name || 'Panel'} failed to render
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
