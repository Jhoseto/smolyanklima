import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import { ServiceRequestModalProvider } from './context/ServiceRequestModalContext';
import { ConsentProvider } from './lib/consent/ConsentProvider';
import './index.css';

if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW blocked or unsupported — PWA still installable */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConsentProvider>
        <ServiceRequestModalProvider>
          <App />
        </ServiceRequestModalProvider>
      </ConsentProvider>
    </BrowserRouter>
  </StrictMode>,
);
