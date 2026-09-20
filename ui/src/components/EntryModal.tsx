'use client';

import React, { useState } from 'react';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    tab: string;
    title: string;
    message: string;
    category: string;
    status: string;
    environment: string;
  }) => Promise<void>;
}

export const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [tab, setTab] = useState<'incident' | 'insight'>('incident');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Nginx');
  const [status, setStatus] = useState('deployed');
  const [environment, setEnvironment] = useState('Production');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        tab,
        title: title.trim(),
        message: message.trim(),
        category,
        status,
        environment,
      });
      // Reset form
      setTitle('');
      setMessage('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Record Production Entry</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-field">
              <label>Target Stream</label>
              <select
                value={tab}
                onChange={(e) => setTab(e.target.value as 'incident' | 'insight')}
              >
                <option value="incident">🚀 Deployments & Incident Tracker</option>
                <option value="insight">💡 Architecture Notes & Insights</option>
              </select>
            </div>

            <div className="form-field">
              <label>Entry Title</label>
              <input
                type="text"
                placeholder="e.g. Deployed Nginx Reverse Proxy with Cloudflare WAF"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-row-2">
              <div className="form-field">
                <label>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Docker">Docker</option>
                  <option value="AWS">AWS EC2</option>
                  <option value="Nginx">Nginx</option>
                  <option value="Cloudflare">Cloudflare</option>
                  <option value="Security">Security</option>
                  <option value="Database">Database</option>
                </select>
              </div>

              <div className="form-field">
                <label>Status / State</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="deployed">Deployed (Blue)</option>
                  <option value="operational">Operational (Green)</option>
                  <option value="investigating">Investigating (Orange)</option>
                  <option value="degraded">Degraded (Yellow)</option>
                  <option value="resolved">Resolved (Green)</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label>Technical Details / Architecture Takeaway</label>
              <textarea
                rows={3}
                placeholder="Explain the deployment change, root cause analysis, or DevOps learning..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Publishing...' : 'Publish to Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
