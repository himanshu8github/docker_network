'use client';

import React, { useState, useEffect } from 'react';

interface BlogItem {
  id: number;
  title: string;
  content: string;
  category: string;
  authorId: number;
  authorUsername: string;
}

interface PostBlogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
  getToken?: (options?: any) => Promise<string | null>;
  userEmail?: string;
  authorUsername?: string;
  apiUrl: string;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  editBlog?: BlogItem | null;
}

export const PostBlogModal: React.FC<PostBlogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  getToken,
  userEmail,
  authorUsername,
  apiUrl,
  addToast,
  editBlog,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Docker');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editBlog) {
      setTitle(editBlog.title);
      setContent(editBlog.content);
      setCategory(editBlog.category);
    } else {
      setTitle('');
      setContent('');
      setCategory('Docker');
    }
  }, [editBlog, isOpen]);

  if (!isOpen) return null;

  const charCount = content.length;
  const isValidLength = charCount >= 100 && charCount <= 1500;
  const hasEmoji =
    /\p{Extended_Pictographic}/u.test(title) || /\p{Extended_Pictographic}/u.test(content);
  const hasImage =
    /<img|!\[|data:image/i.test(title) || /<img|!\[|data:image/i.test(content);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let activeToken = token;
    if (getToken) {
      try {
        activeToken = (await getToken()) || token;
      } catch (err) {
        console.warn('Could not fetch fresh Clerk token:', err);
      }
    }

    if (!activeToken) {
      addToast('error', 'Please sign in to publish blogs');
      return;
    }

    if (hasEmoji) {
      addToast('error', 'Emojis are strictly prohibited. Plain text only.');
      return;
    }

    if (hasImage) {
      addToast('error', 'Images are strictly prohibited. Plain text only.');
      return;
    }

    if (!isValidLength) {
      addToast('error', 'Content must be between 100 and 1,500 characters');
      return;
    }

    setLoading(true);
    try {
      const url = editBlog ? `${apiUrl}/blogs/${editBlog.id}` : `${apiUrl}/blogs`;
      const method = editBlog ? 'PATCH' : 'POST';

      const sendRequest = async (jwt: string) => {
        return await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
            'x-user-email': userEmail || '',
            'x-user-name': authorUsername || '',
          },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            category,
          }),
        });
      };

      let res = await sendRequest(activeToken);

      // If token expired (401), automatically refresh token and retry once!
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
        throw new Error(data.message || 'Failed to publish blog');
      }

      addToast(
        'success',
        editBlog ? 'Blog updated successfully!' : 'Blog published successfully to public feed!'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-card-header">
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
            {editBlog ? 'Edit Technical Article' : 'Publish Technical Article'}
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
            {(hasEmoji || hasImage) && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #f87171',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                ⚠️ Emojis and images are strictly prohibited. Please remove them before publishing.
              </div>
            )}

            <div className="form-group">
              <label>Article Title (5-200 chars)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Understanding Docker Bridge Network and DNS Isolation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Category Tag</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Docker">#Docker</option>
                <option value="AWS">#AWS</option>
                <option value="DevOps">#DevOps</option>
                <option value="Security">#Security</option>
                <option value="Networking">#Networking</option>
                <option value="Architecture">#Architecture</option>
              </select>
            </div>

            <div className="form-group">
              <label>Content (Plain text, 100 - 1,500 characters)</label>
              <textarea
                className="form-input"
                rows={7}
                placeholder="Share your technical learnings, architecture insights, and code explanations..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
              <div className={`char-counter ${isValidLength ? 'valid' : 'invalid'}`}>
                <span>Min: 100 chars | Max: 1,500 chars</span>
                <span className="mono">
                  {charCount} / 1,500 characters {isValidLength ? '✓' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-card-footer">
            <button
              type="button"
              className="btn-light-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-light-primary"
              disabled={loading || !isValidLength || hasEmoji || hasImage}
            >
              {loading ? 'Publishing...' : editBlog ? 'Update Article' : 'Publish to Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
