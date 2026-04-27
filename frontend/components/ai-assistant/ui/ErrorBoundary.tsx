/**
 * Error Boundary for AI Assistant
 * Handles errors gracefully without breaking UX
 */

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  primaryColor: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AIErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AI Assistant Error:', error, errorInfo);
    (this as any).setState({ error, errorInfo });

    // Send to analytics/monitoring
    this.reportError(error, errorInfo);
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    // In production, send to error tracking service (Sentry, etc.)
    const event = new CustomEvent('ai:error', {
      detail: {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      },
    });
    window.dispatchEvent(event);
  }

  private handleReset = () => {
    (this as any).setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleContactSupport = () => {
    // Open contact form or chat
    const event = new CustomEvent('ai:contactSupport', {
      detail: { reason: 'error_boundary' },
    });
    window.dispatchEvent(event);
  };

  public render() {
    if (this.state.hasError) {
      return (
        (this as any).props.fallback || (
          <ErrorFallback
            error={this.state.error}
            primaryColor={(this as any).props.primaryColor}
            onReset={this.handleReset}
            onContactSupport={this.handleContactSupport}
          />
        )
      );
    }

    return (this as any).props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  primaryColor: string;
  onReset: () => void;
  onContactSupport: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  primaryColor,
  onReset,
  onContactSupport,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'fixed',
        bottom: 100,
        right: 20,
        width: 360,
        backgroundColor: 'white',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        padding: 24,
        zIndex: 9999,
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
          }}
        >
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1e293b',
              margin: 0,
            }}
          >
            Упс, нещо се обърка
          </h3>
          <p
            style={{
              fontSize: 13,
              color: '#64748b',
              margin: '4px 0 0 0',
            }}
          >
            Но сме тук, за да помогнем!
          </p>
        </div>
      </div>

      <p
        style={{
          fontSize: 14,
          color: '#475569',
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        Асистентът срещна техническа трудност. Можете да опитате отново или да се свържете с нас на телефон за бърза помощ.
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onReset}
          style={{
            flex: 1,
            backgroundColor: primaryColor,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <RefreshCw size={16} />
          Опитай отново
        </button>

        <button
          onClick={onContactSupport}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            color: primaryColor,
            border: `2px solid ${primaryColor}`,
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <MessageCircle size={16} />
          Свържи се с нас
        </button>
      </div>

      <p
        style={{
          fontSize: 12,
          color: '#94a3b8',
          textAlign: 'center',
          marginTop: 16,
          marginBottom: 0,
        }}
      >
        Телефон: 0876 123 456
      </p>
    </motion.div>
  );
};

export default AIErrorBoundary;
