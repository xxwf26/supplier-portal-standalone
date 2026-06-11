// Polyfill for @lark-apaas/client-toolkit/components/*
import React from 'react';

// Polyfill for AppContainer
export function AppContainer({ children, ..._props }: { children: React.ReactNode; defaultTheme?: string }) {
  return <>{children}</>;
}

// Polyfill for ErrorRender
export function ErrorRender({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2>Something went wrong</h2>
      <pre style={{ color: 'red', margin: '16px 0' }}>{error.message}</pre>
      <button onClick={resetErrorBoundary} style={{ padding: '8px 16px', cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  );
}

// Polyfill for NotFoundRender
export function NotFoundRender() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1 style={{ fontSize: 72, color: '#ccc' }}>404</h1>
      <p style={{ color: '#999' }}>Page not found</p>
    </div>
  );
}