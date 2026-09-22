import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import AdminApp from './AdminApp';
import './index.css';

const clerkPubKey =
  (import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY as string) ||
  'pk_test_dXByaWdodC1sb25naG9ybi04NzMuY2xlcmsuYWNjb3VudHMuZGV2JA';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <AdminApp />
    </ClerkProvider>
  </React.StrictMode>,
);
