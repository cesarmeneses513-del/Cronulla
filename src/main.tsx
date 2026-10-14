import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {I18nProvider} from './i18n';
import './index.css';

// Shown in the browser console: which build a device is running. Changing it publishes a new
// version, which makes every open copy of the app offer (or do) a reload.
console.info('Cronulla build 2026-10-14.2');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);

// Installed app (PWA): offline shell and faster loads. Only in the deployed site.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker not registered', err));
  });
}
