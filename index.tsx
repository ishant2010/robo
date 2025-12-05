import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode can cause double-invocations in dev, which might complicate audio context handling slightly,
  // but we will keep it for best practices.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);