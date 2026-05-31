import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LicenseProvider } from './context/LicenseContext';
import App from './App';
import '@xyflow/react/dist/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LicenseProvider>
          <App />
        </LicenseProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
