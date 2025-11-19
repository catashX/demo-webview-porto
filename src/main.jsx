import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('🟢 main.jsx loaded');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found!');
  }

  console.log('🟢 Mounting React app...');
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('✅ React app mounted successfully');
} catch (error) {
  console.error('❌ Failed to mount React app:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: red;">App Failed to Load</h1>
      <p>Error: ${error.message}</p>
      <pre style="background: #f0f0f0; padding: 10px; overflow: auto;">
        ${error.stack}
      </pre>
    </div>
  `;
}
