import React, { useState } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { CustomToast, ToastMessage } from './components/CustomToast';

export default function AdminApp() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const apiUrl =
    (import.meta as any).env?.VITE_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname.includes('gradmetric.me')
      ? 'https://api.gradmetric.me'
      : 'http://localhost:3000');

  return (
    <>
      <CustomToast toasts={toasts} onDismiss={removeToast} />
      <AdminPortal
        apiUrl={apiUrl}
        addToast={addToast}
      />
    </>
  );
}
