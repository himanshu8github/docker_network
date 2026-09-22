import React, { useState, useEffect, useCallback } from 'react';
import { AuthModal } from './components/AuthModal';
import { PostBlogModal } from './components/PostBlogModal';
import { CustomToast, ToastMessage } from './components/CustomToast';

interface BlogItem {
  id: number;
  title: string;
  content: string;
  category: string;
  authorId: number;
  authorUsername: string;
  createdAt: string;
}

export default function App() {
  // Blog feed state
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [totalBlogs, setTotalBlogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingBlogs, setLoadingBlogs] = useState(true);

  // User state
  const [userToken, setUserToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modals & view state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogItem | null>(null);
  const [readingBlog, setReadingBlog] = useState<BlogItem | null>(null);
  const [viewMode, setViewMode] = useState<'horizontal' | 'grid'>('horizontal');

  // Toast state
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

  // Restore saved user token
  useEffect(() => {
    const savedToken = localStorage.getItem('cloudops_user_token');
    const savedUser = localStorage.getItem('cloudops_user_data');
    if (savedToken && savedUser) {
      setUserToken(savedToken);
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {}
    }
  }, []);

  // Record visit on initial page load (tracking Cloudflare headers & page views)
  useEffect(() => {
    fetch(`${apiUrl}/analytics/visit`, { method: 'GET' }).catch(() => {});
  }, [apiUrl]);

  // Fetch paginated blogs
  const fetchBlogs = useCallback(
    async (page = 1, category = 'All', search = '') => {
      setLoadingBlogs(true);
      try {
        const catQuery = category !== 'All' ? `&category=${encodeURIComponent(category)}` : '';
        const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
        const res = await fetch(`${apiUrl}/blogs?page=${page}&limit=6${catQuery}${searchQuery}`);

        if (res.ok) {
          const data = await res.json();
          setBlogs(data.items || []);
          setTotalBlogs(data.total || 0);
          setCurrentPage(data.page || 1);
          setTotalPages(data.totalPages || 1);
        }
      } catch {
        addToast('error', 'Unable to fetch blogs from API');
      } finally {
        setLoadingBlogs(false);
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    fetchBlogs(currentPage, selectedCategory, searchTerm);
  }, [currentPage, selectedCategory, searchTerm, fetchBlogs]);

  const handleUserLoginSuccess = (token: string, user: any) => {
    setUserToken(token);
    setCurrentUser(user);
    localStorage.setItem('cloudops_user_token', token);
    localStorage.setItem('cloudops_user_data', JSON.stringify(user));
  };

  const handleUserLogout = () => {
    setUserToken(null);
    setCurrentUser(null);
    localStorage.removeItem('cloudops_user_token');
    localStorage.removeItem('cloudops_user_data');
    addToast('info', 'Logged out successfully');
  };

  const handleOpenPostModal = () => {
    if (!userToken) {
      addToast('info', 'Please sign in to write an article');
      setIsAuthOpen(true);
      return;
    }
    setEditingBlog(null);
    setIsPostOpen(true);
  };

  const handleOpenEditModal = (blog: BlogItem) => {
    if (!userToken) {
      addToast('info', 'Please sign in to edit articles');
      setIsAuthOpen(true);
      return;
    }
    setEditingBlog(blog);
    setIsPostOpen(true);
  };

  const categories = ['All', 'Docker', 'AWS', 'DevOps', 'Security', 'Networking', 'Architecture'];

  // Render Public Blog Portal (Screenshot 1 Cream Aesthetic)
  return (
    <div className="light-portal">
      <CustomToast toasts={toasts} onDismiss={removeToast} />

      <div className="portal-container">
        {/* Top Header Bar */}
        <header className="blog-header">
          <div className="brand-section">
            <div className="brand-badge" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 800 }}>G</div>
            <div className="brand-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>
                  GradMetric<span style={{ color: '#7c3aed', fontWeight: 600 }}>.me</span>
                </h1>
                <span className="total-blogs-pill" title="Total articles on platform">
                  ⚡ {totalBlogs} {totalBlogs === 1 ? 'Article' : 'Articles'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0' }}>CloudOps Community & Engineering Insights</p>
            </div>
          </div>

          {/* Search Bar matching Screenshot 1 */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Try searching insights, docker, networking..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="header-actions">
            <button className="btn-light-primary" onClick={handleOpenPostModal}>
              <span>+</span>
              <span>Write Article</span>
            </button>

            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  className="author-chip"
                  style={{
                    background: '#ffffff',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: '1px solid #e9e5de',
                  }}
                >
                  <div
                    className="avatar-circle"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}
                  >
                    {currentUser.username[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    @{currentUser.username}
                  </span>
                </div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={handleUserLogout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                className="btn-light-secondary"
                onClick={() => setIsAuthOpen(true)}
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Category Filter & Top Stats Bar */}
        <div className="top-stats-bar">
          <div className="category-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
              >
                #{cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="stats-indicator">
              <span style={{ fontSize: '15px' }}>📰</span>
              <span>Total Articles in Website:</span>
              <span className="stats-count">{totalBlogs}</span>
            </div>

            <div className="view-toggle-wrap">
              <button
                className={`view-toggle-btn ${viewMode === 'horizontal' ? 'active' : ''}`}
                onClick={() => setViewMode('horizontal')}
                title="Display cards horizontally"
              >
                <span>☰</span>
                <span>Horizontal</span>
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Display cards in multi-column grid"
              >
                <span>⊞</span>
                <span>Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Blog Feed (Horizontal Cards or Grid) */}
        {loadingBlogs ? (
          <div className="empty-box">Loading articles from MySQL...</div>
        ) : blogs.length === 0 ? (
          <div className="empty-box">
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#1e242d',
                marginBottom: '6px',
              }}
            >
              No articles published yet
            </h3>
            <p
              style={{
                fontSize: '13px',
                color: '#656d78',
                marginBottom: '16px',
              }}
            >
              Be the first engineer to publish a technical article to the community
              feed!
            </p>
            <button
              className="btn-light-primary"
              style={{ margin: '0 auto' }}
              onClick={handleOpenPostModal}
            >
              + Write First Article
            </button>
          </div>
        ) : viewMode === 'horizontal' ? (
          /* HORIZONTAL CARDS DISPLAY */
          <div className="blogs-horizontal-list">
            {blogs.map((b) => {
              const isAuthor =
                currentUser &&
                (currentUser.id === b.authorId || currentUser.role === 'admin');
              const dateStr = new Date(b.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <article
                  key={b.id}
                  className="blog-card-horizontal"
                  onClick={() => setReadingBlog(b)}
                >
                  <div className="blog-horizontal-header">
                    <div className="author-chip">
                      <div className="avatar-circle">
                        {b.authorUsername
                          ? b.authorUsername[0].toUpperCase()
                          : 'U'}
                      </div>
                      <div className="author-info">
                        <span className="author-name">
                          @{b.authorUsername}
                        </span>
                        <span className="post-date">{dateStr}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="blog-cat-badge">#{b.category}</span>
                      <span style={{ fontSize: '11px', color: 'var(--light-text-dim)' }}>
                        {b.content.length} chars
                      </span>
                    </div>
                  </div>

                  <div>
                    <h2 className="blog-horizontal-title">{b.title}</h2>
                    <p className="blog-horizontal-snippet">{b.content}</p>
                  </div>

                  <div
                    className="blog-horizontal-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      style={{
                        color: 'var(--light-accent-blue)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => setReadingBlog(b)}
                    >
                      Read Full Article →
                    </span>
                    {isAuthor && (
                      <button
                        className="btn-edit-blog"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(b);
                        }}
                      >
                        ✎ Edit Post
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* MULTI-COLUMN HORIZONTAL GRID DISPLAY */
          <div className="blogs-grid">
            {blogs.map((b) => {
              const isAuthor =
                currentUser &&
                (currentUser.id === b.authorId || currentUser.role === 'admin');
              const dateStr = new Date(b.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <article
                  key={b.id}
                  className="blog-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setReadingBlog(b)}
                >
                  <div>
                    <div className="blog-card-header">
                      <div className="author-chip">
                        <div className="avatar-circle">
                          {b.authorUsername
                            ? b.authorUsername[0].toUpperCase()
                            : 'U'}
                        </div>
                        <div className="author-info">
                          <span className="author-name">
                            @{b.authorUsername}
                          </span>
                          <span className="post-date">{dateStr}</span>
                        </div>
                      </div>
                      <span className="blog-cat-badge">#{b.category}</span>
                    </div>

                    <h2 className="blog-title">{b.title}</h2>
                    <p className="blog-snippet">{b.content}</p>
                  </div>

                  <div
                    className="blog-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      style={{
                        color: 'var(--light-accent-blue)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => setReadingBlog(b)}
                    >
                      Read →
                    </span>
                    {isAuthor && (
                      <button
                        className="btn-edit-blog"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(b);
                        }}
                      >
                        ✎ Edit Post
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-wrap">
            <button
              className="btn-page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            <span className="page-indicator">
              Page {currentPage} of {totalPages} ({totalBlogs} total articles)
            </span>
            <button
              className="btn-page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Full Article Reader Modal */}
      {readingBlog && (
        <div className="reader-modal-overlay" onClick={() => setReadingBlog(null)}>
          <div className="reader-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="reader-modal-header">
              <div className="author-chip">
                <div className="avatar-circle">
                  {readingBlog.authorUsername
                    ? readingBlog.authorUsername[0].toUpperCase()
                    : 'U'}
                </div>
                <div className="author-info">
                  <span className="author-name">@{readingBlog.authorUsername}</span>
                  <span className="post-date">
                    {new Date(readingBlog.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="blog-cat-badge">#{readingBlog.category}</span>
                <button
                  onClick={() => setReadingBlog(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px 8px',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="reader-modal-body">
              <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '16px', color: '#1e242d' }}>
                {readingBlog.title}
              </h1>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.75', color: '#334155' }}>
                {readingBlog.content}
              </div>
            </div>
            <div className="reader-modal-footer">
              <span style={{ fontSize: '12px', color: 'var(--light-text-dim)' }}>
                {readingBlog.content.length} characters
              </span>
              <button className="btn-light-secondary" onClick={() => setReadingBlog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Sign In / Register Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleUserLoginSuccess}
        addToast={addToast}
        apiUrl={apiUrl}
      />

      {/* Write / Edit Article Modal */}
      <PostBlogModal
        isOpen={isPostOpen}
        onClose={() => {
          setIsPostOpen(false);
          setEditingBlog(null);
        }}
        onSuccess={() => fetchBlogs(currentPage, selectedCategory, searchTerm)}
        token={userToken}
        apiUrl={apiUrl}
        addToast={addToast}
        editBlog={editingBlog}
      />
    </div>
  );
}
