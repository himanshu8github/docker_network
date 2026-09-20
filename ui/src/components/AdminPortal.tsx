'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface AdminPortalProps {
  onBackToBlog?: () => void;
  apiUrl: string;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onBackToBlog,
  apiUrl,
  addToast,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stream' | 'users' | 'visits'>('stream');

  // Login form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard data state
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [visitsData, setVisitsData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Check saved admin token
  useEffect(() => {
    const saved = localStorage.getItem('cloudops_admin_token');
    if (saved) setAdminToken(saved);
  }, []);

  // Fetch Dashboard Metrics (Protected)
  const fetchMetrics = useCallback(async () => {
    if (!adminToken) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${apiUrl}/dashboard/metrics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401 || res.status === 403) {
        setAdminToken(null);
        localStorage.removeItem('cloudops_admin_token');
        addToast('error', 'Admin session expired. Please sign in again.');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      // Background poll failure
    } finally {
      setRefreshing(false);
    }
  }, [adminToken, apiUrl, addToast]);

  // Fetch Users Directory (Protected)
  const fetchUsers = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch(`${apiUrl}/dashboard/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // Silent error
    }
  }, [adminToken, apiUrl]);

  // Fetch Visits Analytics (Protected)
  const fetchVisits = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch(`${apiUrl}/dashboard/visits`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVisitsData(data);
      }
    } catch {
      // Silent error
    }
  }, [adminToken, apiUrl]);

  useEffect(() => {
    if (adminToken) {
      fetchMetrics();
      fetchUsers();
      fetchVisits();
      // Auto-refresh metrics every 5 seconds for live stream!
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [adminToken, fetchMetrics, fetchUsers, fetchVisits]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Admin authentication failed');
      }

      setAdminToken(data.accessToken);
      localStorage.setItem('cloudops_admin_token', data.accessToken);
      addToast('success', 'Admin session authorized (Valid for 24 Hours)');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('cloudops_admin_token');
    addToast('info', 'Admin logged out');
  };

  // If not logged in as Admin, show Admin Gate
  if (!adminToken) {
    return (
      <div className="dark-portal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="modal-card dark" style={{ width: '100%', maxWidth: '440px' }}>
          <div className="modal-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Admin Observability Gate</h3>
            </div>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--dark-text-dim)', fontSize: '13px', cursor: 'pointer' }}
              onClick={onBackToBlog}
            >
              ← Public Blog
            </button>
          </div>

          <form onSubmit={handleAdminLogin}>
            <div className="modal-card-body">
              <p style={{ fontSize: '13px', color: 'var(--dark-text-muted)' }}>
                Access to live ingress telemetry, registered users, and Cloudflare analytics requires an authorized Admin account.
              </p>

              <div className="form-group">
                <label>Admin Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@gradmetric.me"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Admin Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-card-footer" style={{ justifyContent: onBackToBlog ? 'space-between' : 'flex-end' }}>
              {onBackToBlog && (
                <button
                  type="button"
                  className="btn-light-secondary"
                  style={{ backgroundColor: 'transparent', color: '#94a3b8', borderColor: '#1f2c44' }}
                  onClick={onBackToBlog}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                className="btn-light-primary"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none' }}
                disabled={loginLoading}
              >
                {loginLoading ? 'Verifying...' : 'Authorize Access'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-portal">
      {/* Admin Top Navigation */}
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-badge-icon">⚡</div>
          <div>
            <h2>CloudOps <span>Telemetry</span></h2>
            <p style={{ fontSize: '11px', color: 'var(--dark-text-dim)', letterSpacing: '0.05em' }}>
              ADMIN OBSERVABILITY CONSOLE • 100% LIVE
            </p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'stream' ? 'active' : ''}`}
            onClick={() => setActiveTab('stream')}
          >
            ⚡ Live Ingress Stream
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('users');
              fetchUsers();
            }}
          >
            👥 Users Directory ({users.length})
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'visits' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('visits');
              fetchVisits();
            }}
          >
            🌐 Visit Analytics
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-page"
            style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
            onClick={fetchMetrics}
          >
            {refreshing ? '↻ Syncing...' : '↻ Refresh'}
          </button>
          <button
            className="btn-light-secondary"
            style={{ backgroundColor: 'transparent', color: '#cbd5e1', borderColor: '#334155', fontSize: '12px' }}
            onClick={onBackToBlog}
          >
            ← View Blog
          </button>
          <button
            style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <main className="admin-container">
        {/* Top Metric Cards (Screenshot 2 Web3 Glow Cards) */}
        <div className="dark-stat-grid">
          <div className="dark-stat-card">
            <div className="dark-stat-header">TOTAL SYSTEM REQUESTS</div>
            <div className="dark-stat-val" style={{ color: 'var(--dark-blue)' }}>
              {metrics ? metrics.counters.totalRequests : 0}
            </div>
            <div className="dark-stat-sub">
              GET: {metrics ? metrics.counters.getRequests : 0} • POST: {metrics ? metrics.counters.postRequests : 0}
            </div>
          </div>

          <div className="dark-stat-card">
            <div className="dark-stat-header">DATABASE PING LATENCY</div>
            <div className="dark-stat-val" style={{ color: 'var(--dark-green)' }}>
              {metrics && metrics.overview.dbLatencyMs >= 0 ? `${metrics.overview.dbLatencyMs} ms` : '--'}
            </div>
            <div className="dark-stat-sub">
              Status: {metrics ? metrics.overview.dbStatus : 'Connecting'} (MySQL 8)
            </div>
          </div>

          <div className="dark-stat-card">
            <div className="dark-stat-header">CONTAINER MEMORY (RSS)</div>
            <div className="dark-stat-val" style={{ color: 'var(--dark-purple)' }}>
              {metrics ? `${metrics.overview.memoryRssMb} MB` : '--'}
            </div>
            <div className="dark-stat-sub">
              Uptime: {metrics ? metrics.overview.uptimeFormatted : '--'}
            </div>
          </div>

          <div className="dark-stat-card">
            <div className="dark-stat-header">CLOUDFLARE EDGE STATUS</div>
            <div className="dark-stat-val" style={{ color: 'var(--dark-orange)' }}>
              {metrics?.cloudflare?.isCloudflare ? '🟠 Proxied' : 'Direct Ingress'}
            </div>
            <div className="dark-stat-sub mono">
              Ray: {metrics ? metrics.cloudflare.cfRay.slice(0, 16) : 'local'}
            </div>
          </div>
        </div>

        {/* TAB 1: Live Ingress Stream */}
        {activeTab === 'stream' && (
          <div className="dark-panel-box">
            <div className="dark-panel-header">
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Real-Time Ingress Request Stream</h3>
                <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                  Live feed of HTTP requests forwarded through Nginx and Cloudflare to NestJS (0 hardcoded data)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className="badge-method GET">2xx: {metrics ? metrics.counters.status2xx : 0}</span>
                <span className="badge-method DELETE">4xx: {metrics ? metrics.counters.status4xx : 0}</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="dark-table">
                <thead>
                  <tr>
                    <th>METHOD</th>
                    <th>ENDPOINT / ROUTE</th>
                    <th>STATUS</th>
                    <th>LATENCY</th>
                    <th>CLOUDFLARE RAY</th>
                    <th>CLIENT IP</th>
                    <th>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {!metrics || metrics.liveStream.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--dark-text-dim)' }}>
                        No incoming requests recorded yet. Use the public blog to generate real traffic!
                      </td>
                    </tr>
                  ) : (
                    metrics.liveStream.map((log: any) => (
                      <tr key={log.id}>
                        <td>
                          <span className={`badge-method ${log.method}`}>{log.method}</span>
                        </td>
                        <td style={{ color: '#f8fafc', fontWeight: 500 }}>{log.url}</td>
                        <td>
                          <span style={{ color: log.statusCode < 400 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                            {log.statusCode}
                          </span>
                        </td>
                        <td style={{ color: '#38bdf8' }}>{log.durationMs} ms</td>
                        <td style={{ color: '#a78bfa' }}>{log.cfRay}</td>
                        <td style={{ color: '#94a3b8' }}>{log.clientIp}</td>
                        <td style={{ color: '#64748b' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Users Directory */}
        {activeTab === 'users' && (
          <div className="dark-panel-box">
            <div className="dark-panel-header">
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Registered Users Directory</h3>
                <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                  Audited accounts saved in MySQL with role attribution and total published articles
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="dark-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>USERNAME</th>
                    <th>EMAIL ADDRESS</th>
                    <th>ROLE</th>
                    <th>ARTICLES POSTED</th>
                    <th>REGISTERED DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dark-text-dim)' }}>
                        No registered users in database yet.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td style={{ color: '#f8fafc', fontWeight: 600 }}>@{u.username}</td>
                        <td>{u.email}</td>
                        <td>
                          <span
                            className="badge-method"
                            style={{
                              backgroundColor: u.role === 'admin' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                              color: u.role === 'admin' ? '#a78bfa' : '#38bdf8',
                              border: 'none',
                            }}
                          >
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>{u.blogsCount} blogs</td>
                        <td style={{ color: '#64748b' }}>
                          {new Date(u.registeredAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Visit Analytics */}
        {activeTab === 'visits' && (
          <div className="dark-panel-box">
            <div className="dark-panel-header">
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Page Visits & Edge Analytics</h3>
                <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                  Total Visits Tracked: <strong style={{ color: '#38bdf8' }}>{visitsData ? visitsData.totalVisits : 0}</strong>
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="dark-table">
                <thead>
                  <tr>
                    <th>VISIT ID</th>
                    <th>ENDPOINT</th>
                    <th>VISITOR IP</th>
                    <th>COUNTRY</th>
                    <th>CLOUDFLARE RAY</th>
                    <th>TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody>
                  {!visitsData || visitsData.recentVisits.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dark-text-dim)' }}>
                        No page visits recorded yet.
                      </td>
                    </tr>
                  ) : (
                    visitsData.recentVisits.map((v: any) => (
                      <tr key={v.id}>
                        <td>#{v.id}</td>
                        <td style={{ color: '#f8fafc', fontWeight: 500 }}>{v.endpoint}</td>
                        <td>{v.clientIp}</td>
                        <td>
                          <span style={{ color: '#fb923c', fontWeight: 600 }}>{v.country}</span>
                        </td>
                        <td style={{ color: '#a78bfa' }}>{v.cfRay}</td>
                        <td style={{ color: '#64748b' }}>
                          {new Date(v.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
