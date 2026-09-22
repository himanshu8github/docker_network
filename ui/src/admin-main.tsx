import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import AdminApp from './AdminApp';
import './index.css';

const clerkPubKey = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {clerkPubKey ? (
      <ClerkProvider publishableKey={clerkPubKey}>
        <AdminApp />
      </ClerkProvider>
    ) : (
      <AdminApp />
    )}
  </React.StrictMode>,
);
