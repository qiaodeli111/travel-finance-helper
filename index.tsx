import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TranslationProvider } from './i18n/useTranslation';
import { AuthProvider } from './src/contexts/AuthContext';
import { CloudSyncProvider } from './src/contexts/CloudSyncContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <TranslationProvider>
      <AuthProvider>
        <CloudSyncProvider>
          <App />
        </CloudSyncProvider>
      </AuthProvider>
    </TranslationProvider>
  </React.StrictMode>
);