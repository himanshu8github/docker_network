'use client';

import React, { useState, useEffect } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  apiUrl: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  addToast,
  apiUrl,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Real-time Bloom Filter Username Availability State
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  // Debounced Bloom Filter Username Check
  useEffect(() => {
    if (!isRegister || !username.trim()) {
      setUsernameStatus({ checking: false });
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Alphanumeric characters only (no spaces or symbols)',
      });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Must be between 3 and 30 characters',
      });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true });
      try {
        const res = await fetch(`${apiUrl}/auth/check-username?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          setUsernameStatus({
            checking: false,
            available: data.available,
            message: data.message,
          });
        }
      } catch {
        setUsernameStatus({ checking: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, isRegister, apiUrl]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Emoji check
    if (/\p{Extended_Pictographic}/u.test(email) || /\p{Extended_Pictographic}/u.test(password)) {
      addToast('error', 'Emojis are strictly prohibited');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? `${apiUrl}/auth/register` : `${apiUrl}/auth/login`;
      const body = isRegister ? { email, username, password } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      addToast('success', isRegister ? 'Account registered successfully!' : 'Logged in successfully!');
      onSuccess(data.accessToken, data.user);
      onClose();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
            {isRegister ? 'Create an Account' : 'Sign In to Blog Portal'}
          </h3>
          <button
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-card-body">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {isRegister && (
              <div className="form-group">
                <label>Username (Alphanumeric Only)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="alexdev24"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                {username.trim() && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      marginTop: '4px',
                      color: usernameStatus.available ? '#059669' : '#e11d48',
                    }}
                  >
                    {usernameStatus.checking
                      ? '⚡ Bloom Filter checking...'
                      : usernameStatus.message}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Password (Min 6 chars)</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-card-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer' }}
              onClick={() => {
                setIsRegister(!isRegister);
                setUsernameStatus({ checking: false });
              }}
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>

            <button type="submit" className="btn-light-primary" disabled={loading}>
              {loading ? 'Processing...' : isRegister ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
