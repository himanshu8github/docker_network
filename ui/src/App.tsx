import React, { useState, useEffect, useCallback } from 'react';
import { AuthModal } from './components/AuthModal';
import { PostBlogModal } from './components/PostBlogModal';
import { AdminPortal } from './components/AdminPortal';
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
  const [viewMode, setViewMode] = useState<'blog' | 'admin'>('blog');

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

  // Modals state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogItem | null>(null);

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

  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

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

  // Render Admin View if toggled
  if (viewMode === 'admin') {
    return (
      <>
        <CustomToast toasts={toasts} onDismiss={removeToast} />
        <AdminPortal
          onBackToBlog={() => setViewMode('blog')}
          apiUrl={apiUrl}
          addToast={addToast}
        />
      </>
    );
  }

  // Render Public Blog Portal (Screenshot 1 Cream Aesthetic)
  return (
    <div className="light-portal">
      <CustomToast toasts={toasts} onDismiss={removeToast} />

      <div className="portal-container">
        {/* Top Header Bar */}
        <header className="blog-header">
          <div className="brand-section">
            <div className="brand-badge">C</div>
            <div className="brand-text">
              <h1>CloudOps.tech</h1>
              <p>Community Engineering & Cloud Insights</p>
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

            {/* Admin Switcher */}
            <button
              className="btn-admin-switch"
              onClick={() => setViewMode('admin')}
            >
              <span>🛡️</span>
              <span>Admin Console</span>
            </button>
          </div>
        </header>

        {/* Category Pills */}
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

        {/* Blog Feed Grid */}
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
        ) : (
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
                <article key={b.id} className="blog-card">
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

                  <div className="blog-footer">
                    <span>{b.content.length} characters</span>
                    {isAuthor && (
                      <button
                        className="btn-edit-blog"
                        onClick={() => handleOpenEditModal(b)}
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
