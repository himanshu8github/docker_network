import React, { useState } from 'react';

interface SetUsernameModalProps {
  isOpen: boolean;
  apiUrl: string;
  token: string | null;
  getToken?: (options?: any) => Promise<string | null>;
  currentEmail: string;
  onSuccess: (newUsername: string) => void;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const SetUsernameModal: React.FC<SetUsernameModalProps> = ({
  isOpen,
  apiUrl,
  token,
  getToken,
  currentEmail,
  onSuccess,
  addToast,
}) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Validation: Strictly alphanumeric, min 4 and max 10 characters
  const isAlphanumeric = /^[a-zA-Z0-9]+$/.test(username);
  const hasValidLength = username.length >= 4 && username.length <= 10;
  const isValid = isAlphanumeric && hasValidLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg('Username must be 4–10 characters and alphanumeric only.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      let activeToken = token;
      if (getToken) {
        try {
          activeToken = (await getToken()) || token;
        } catch (tokenErr) {
          console.warn('Could not fetch fresh Clerk token:', tokenErr);
        }
      }

      const sendRequest = async (jwt: string) => {
        return await fetch(`${apiUrl}/auth/set-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ username }),
        });
      };

      let res = await sendRequest(activeToken || '');

      // Retry once on 401 with refreshed token
      if (res.status === 401 && getToken) {
        try {
          const freshToken = await getToken({ skipCache: true });
          if (freshToken) {
            activeToken = freshToken;
            res = await sendRequest(freshToken);
          }
        } catch {}
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update username');
      }

      addToast('success', `Welcome, @${username}! Handle claimed successfully.`);
      onSuccess(username);
    } catch (err: any) {
      setErrorMsg(err.message);
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card dark" style={{ maxWidth: '440px', padding: '28px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🚀</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Choose Your Handle
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
            Welcome to <span style={{ color: '#38bdf8', fontWeight: 600 }}>CloudOps.Gradmetric</span> ({currentEmail}). Claim your unique author handle to publish posts.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '12px',
              marginBottom: '16px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Author Username
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                @
              </span>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. devops99"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10));
                  setErrorMsg('');
                }}
                autoFocus
                style={{
                  paddingLeft: '32px',
                  backgroundColor: '#0f172a',
                  borderColor: isValid ? '#10b981' : '#334155',
                  color: '#f8fafc',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>

          {/* Validation requirements checklist */}
          <div
            style={{
              backgroundColor: '#0f172a',
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '11px',
              border: '1px solid #1e293b',
            }}
          >
            <div
              style={{
                color: hasValidLength ? '#34d399' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
              }}
            >
              <span>{hasValidLength ? '✓' : '•'}</span>
              <span>Length: 4 to 10 characters ({username.length}/10)</span>
            </div>
            <div
              style={{
                color: isAlphanumeric && username.length > 0 ? '#34d399' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{isAlphanumeric && username.length > 0 ? '✓' : '•'}</span>
              <span>Letters & numbers only (no spaces or special chars)</span>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={!isValid || loading}
            style={{
              width: '100%',
              padding: '12px',
              fontWeight: 700,
              fontSize: '14px',
              opacity: isValid && !loading ? 1 : 0.6,
              cursor: isValid && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Claiming Handle...' : 'Save & Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
};
