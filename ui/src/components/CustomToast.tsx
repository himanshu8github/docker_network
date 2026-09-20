'use client';

import React from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface CustomToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const CustomToast: React.FC<CustomToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-box">
      {toasts.map((toast) => {
        const icon =
          toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️';

        return (
          <div
            key={toast.id}
            className={`app-toast ${toast.type}`}
            onClick={() => onDismiss(toast.id)}
          >
            <span>{icon}</span>
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
};
