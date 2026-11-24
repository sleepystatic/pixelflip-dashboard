import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { API_HOST, LOCAL_UI_REMOTE_API } from './config';

// Shown only when the dashboard runs locally against a remote backend, which
// is never true in production (there the page itself is remote). Fixed to the
// bottom and click-through, so it warns without getting in the way.
function ProductionApiBanner() {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2147483647,
        background: '#b91c1c', color: '#ffffff', textAlign: 'center',
        font: '600 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif',
        padding: '5px 16px', pointerEvents: 'none',
      }}
    >
      Local dashboard, PRODUCTION backend ({API_HOST}). Arming, settings and checkout here are real.
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {LOCAL_UI_REMOTE_API && <ProductionApiBanner />}
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
