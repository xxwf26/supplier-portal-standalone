import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { AppContainer, ErrorRender } from '@/lib/polyfills/components';
import { AuthProvider } from '@/lib/auth';
import AppRoutes from './app';
import './index.css';
import { createPortal } from 'react-dom';
import { Toaster } from '@/components/ui/sonner';

const MainApp = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppContainer defaultTheme="light">
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <ErrorRender error={error as Error} resetErrorBoundary={resetErrorBoundary} />
          )}
        >
          <AppRoutes />
          {createPortal(<Toaster />, document.body)}
        </ErrorBoundary>
      </AppContainer>
    </AuthProvider>
  </BrowserRouter>
);

createRoot(document.getElementById('root')!).render(<MainApp />);