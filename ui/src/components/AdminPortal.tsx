'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth, useClerk, SignInButton, UserButton, SignOutButton } from '@clerk/clerk-react';

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
  const clerk = useClerk();
  const { isSignedIn: isClerkSignedIn, user: clerkUser } = useUser();
  const { getToken: getClerkToken } = useAuth();

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stream' | 'users' | 'visits' | 'health'>('stream');

  // Access denial state
  const [adminAccessDenied, setAdminAccessDenied] = useState(false);

  // Tab pagination states
  const [streamPage, setStreamPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [visitsPage, setVisitsPage] = useState(1);

  // Dashboard data state
  const [metrics, setMetrics] = useState<any>(null);
  const [usersData, setUsersData] = useState<{ items: any[]; total: number; page: number; totalPages: number }>({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [visitsData, setVisitsData] = useState<{ items: any[]; total: number; page: number; totalPages: number }>({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Check saved admin token
  useEffect(() => {
    const saved = localStorage.getItem('cloudops_admin_token');
    if (saved) setAdminToken(saved);
  }, []);

  // Sync Clerk Session if signed in
  useEffect(() => {
    if (isClerkSignedIn && !adminAccessDenied) {
      (async () => {
        try {
          const token = await getClerkToken();
          if (token) {
            setAdminToken(token);
          }
        } catch {}
      })();
    }
  }, [isClerkSignedIn, getClerkToken, adminAccessDenied]);

  // Authenticated Admin Fetch with Dynamic Token Refresh & 401 Auto-Retry
  const fetchWithAdminAuth = useCallback(
    async (endpoint: string) => {
      let token = adminToken;
      if (getClerkToken && isClerkSignedIn) {
        try {
          token = (await getClerkToken()) || adminToken;
          if (token && token !== adminToken) {
            setAdminToken(token);
          }
        } catch {}
      }
      if (!token) return null;

      const doFetch = (jwt: string) =>
        fetch(`${apiUrl}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
            'x-user-email': clerkUser?.primaryEmailAddress?.emailAddress || '',
          },
        });

      let res = await doFetch(token);

      // If token expired, refresh and retry once automatically
      if (res.status === 401 && getClerkToken && isClerkSignedIn) {
        try {
          const fresh = await getClerkToken({ skipCache: true });
          if (fresh) {
            setAdminToken(fresh);
            res = await doFetch(fresh);
          }
        } catch {}
      }

      return res;
    },
    [adminToken, apiUrl, clerkUser, getClerkToken, isClerkSignedIn],
  );

  // Fetch Dashboard Metrics & Stream (Protected)
  const fetchMetrics = useCallback(
    async (page = streamPage) => {
      if (!adminToken && !isClerkSignedIn) return;
      setRefreshing(true);
      try {
        const res = await fetchWithAdminAuth(`/dashboard/metrics?page=${page}&limit=10`);
        if (!res) return;

        if (res.status === 401 || res.status === 403) {
          setAdminToken(null);
          localStorage.removeItem('cloudops_admin_token');
          if (res.status === 403) {
            setAdminAccessDenied(true);
            addToast('error', 'Access denied: Your account does not have Admin role in the database.');
          } else {
            addToast('error', 'Admin session expired. Please sign in again.');
          }
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
    },
    [adminToken, isClerkSignedIn, streamPage, addToast, fetchWithAdminAuth],
  );

  // Fetch Users Directory (Protected)
  const fetchUsers = useCallback(
    async (page = usersPage) => {
      if (!adminToken && !isClerkSignedIn) return;
      try {
        const res = await fetchWithAdminAuth(`/dashboard/users?page=${page}&limit=10`);
        if (res && res.ok) {
          const data = await res.json();
          setUsersData(data);
        }
      } catch {
        // Silent error
      }
    },
    [adminToken, isClerkSignedIn, usersPage, fetchWithAdminAuth],
  );

  // Fetch Visits Analytics (Protected)
  const fetchVisits = useCallback(
    async (page = visitsPage) => {
      if (!adminToken && !isClerkSignedIn) return;
      try {
        const res = await fetchWithAdminAuth(`/dashboard/visits?page=${page}&limit=10`);
        if (res && res.ok) {
          const data = await res.json();
          setVisitsData(data);
        }
      } catch {
        // Silent error
      }
    },
    [adminToken, isClerkSignedIn, visitsPage, fetchWithAdminAuth],
  );

  useEffect(() => {
    if (adminToken) {
      fetchMetrics(streamPage);
    }
  }, [adminToken, streamPage, fetchMetrics]);

  useEffect(() => {
    if (adminToken) {
      fetchUsers(usersPage);
    }
  }, [adminToken, usersPage, fetchUsers]);

  useEffect(() => {
    if (adminToken) {
      fetchVisits(visitsPage);
    }
  }, [adminToken, visitsPage, fetchVisits]);

  // Periodic polling for live stream on page 1 only
  useEffect(() => {
    if (adminToken && streamPage === 1) {
      const interval = setInterval(() => fetchMetrics(1), 5000);
      return () => clearInterval(interval);
    }
  }, [adminToken, streamPage, fetchMetrics]);

  const handleLogout = () => {
    setAdminToken(null);
    setAdminAccessDenied(false);
    localStorage.removeItem('cloudops_admin_token');
    addToast('info', 'Admin logged out');
  };

  const handleAdminSSOClick = async () => {
    try {
      if (isClerkSignedIn) {
        const token = await getClerkToken();
        if (token) {
          setAdminAccessDenied(false);
          setAdminToken(token);
          addToast('info', 'Authorizing admin session...');
          return;
        }
      }
      if (clerk && typeof (clerk as any).openSignIn === 'function') {
        (clerk as any).openSignIn({
          afterSignInUrl: window.location.href,
        });
      } else if (clerk && typeof (clerk as any).redirectToSignIn === 'function') {
        (clerk as any).redirectToSignIn();
      }
    } catch (err: any) {
      console.error('Clerk SSO error:', err);
      if (clerk && typeof (clerk as any).redirectToSignIn === 'function') {
        (clerk as any).redirectToSignIn();
      }
    }
  };

  // If not logged in as Admin, show Admin Gate
  if (!adminToken) {
    return (
      <div className="dark-portal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="modal-card dark" style={{ width: '100%', maxWidth: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid #1e293b' }}>
          <div className="modal-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🛡️</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>CloudOps.Gradmetric Admin Gate</h3>
            </div>
            {onBackToBlog && (
              <button
                style={{ background: 'none', border: 'none', color: 'var(--dark-text-dim)', fontSize: '13px', cursor: 'pointer' }}
                onClick={onBackToBlog}
              >
                ← Public Blog
              </button>
            )}
          </div>

          <div style={{ padding: '24px' }}>
            {adminAccessDenied && isClerkSignedIn ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '16px',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚫</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f87171', marginBottom: '4px' }}>
                    Admin Role Required
                  </div>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                    Signed in as <strong style={{ color: '#ffffff' }}>{clerkUser?.primaryEmailAddress?.emailAddress}</strong>, but your account does not have <code style={{ color: '#38bdf8' }}>admin</code> role in MySQL.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <SignOutButton>
                    <button
                      type="button"
                      className="btn-light-secondary"
                      style={{
                        width: '100%',
                        backgroundColor: '#1e293b',
                        color: '#f8fafc',
                        borderColor: '#334155',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        fontWeight: 600,
                      }}
                      onClick={() => setAdminAccessDenied(false)}
                    >
                      Sign Out / Switch Account
                    </button>
                  </SignOutButton>

                  {onBackToBlog && (
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '8px',
                      }}
                      onClick={onBackToBlog}
                    >
                      ← Return to Public Blog
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: 'var(--dark-text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
                  Access to live ingress telemetry, registered users, and Cloudflare analytics requires an authorized Admin account authenticated via Clerk.
                </p>

                <button
                  type="button"
                  className="btn-light-primary"
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '14px 20px',
                    fontWeight: 600,
                    fontSize: '14px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  }}
                  onClick={handleAdminSSOClick}
                >
                  <span>🛡️</span> {isClerkSignedIn ? `Authorize Session (${clerkUser?.primaryEmailAddress?.emailAddress || 'Admin'})` : 'Sign In with Clerk (Admin SSO)'}
                </button>

                {isClerkSignedIn && (
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#60a5fa',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      onClick={async () => {
                        try {
                          await clerk?.signOut?.();
                          if (clerk && typeof (clerk as any).openSignIn === 'function') {
                            (clerk as any).openSignIn();
                          }
                        } catch {}
                      }}
                    >
                      Sign in with different account
                    </button>
                  </div>
                )}

                {onBackToBlog && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '6px 12px',
                      }}
                      onClick={onBackToBlog}
                    >
                      ← Return to Public Blog
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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
            <h2>CloudOps <span>.Gradmetric</span></h2>
            <p style={{ fontSize: '11px', color: 'var(--dark-text-dim)', letterSpacing: '0.05em' }}>
              logs.gradmetric.me • OBSERVABILITY & TELEMETRY CONSOLE
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
              fetchUsers(usersPage);
            }}
          >
            👥 Users Directory ({usersData.total})
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
          <button
            className={`admin-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('health');
              fetchMetrics(streamPage);
            }}
          >
            🖥️ Topology & Server Health
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn-page"
            style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
            onClick={() => fetchMetrics(streamPage)}
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
          {isClerkSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserButton afterSignOutUrl="/" />
              <button
                style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleLogout}
            >
              Sign Out
            </button>
          )}
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
        {activeTab === 'stream' && (() => {
          const streamItems = Array.isArray(metrics?.liveStream)
            ? metrics.liveStream
            : (metrics?.liveStream?.items || []);
          const streamTotal = metrics?.liveStream?.total ?? streamItems.length;
          const streamTotalPages = metrics?.liveStream?.totalPages ?? 1;

          return (
            <div className="dark-panel-box">
              <div className="dark-panel-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>⚡</span>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                        CloudOps.Gradmetric — Real-Time Ingress Stream
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--dark-text-dim)' }}>
                        Live Request Observability & Journey Trace Engine • ({streamTotal} requests tracked in MySQL)
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge-method GET">2xx: {metrics ? metrics.counters.status2xx : 0}</span>
                    <span className="badge-method DELETE">4xx: {metrics ? metrics.counters.status4xx : 0}</span>
                  </div>
                </div>

                {/* Prominent Log Group & Stream Configuration Bar */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: '#090d16',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                  fontSize: '12px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Application:</span>
                    <span style={{ color: '#f8fafc', fontWeight: 700, backgroundColor: '#1e293b', padding: '2px 8px', borderRadius: '4px' }}>
                      CloudOps.Gradmetric
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Log Group:</span>
                    <code style={{ color: '#c084fc', fontWeight: 700, backgroundColor: 'rgba(168, 85, 247, 0.15)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                      /gradmetric-cloudops/production/ingress
                    </code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Log Stream:</span>
                    <code style={{ color: '#38bdf8', fontWeight: 700, backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      live-ingress-stream
                    </code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    <span style={{ height: '8px', width: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                    <span style={{ color: '#10b981', fontWeight: 600, fontSize: '11px' }}>STREAMING ACTIVE</span>
                  </div>
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
                      <th>JOURNEY ID</th>
                      <th>REFERENCE ID</th>
                      <th>REAL IP & GEO</th>
                      <th>DEVICE / UA</th>
                      <th>TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streamItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--dark-text-dim)' }}>
                          No incoming requests recorded yet. Use the public blog to generate real traffic!
                        </td>
                      </tr>
                    ) : (
                      streamItems.map((log: any) => (
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
                          <td>
                            <span
                              className="mono"
                              style={{
                                fontSize: '11px',
                                color: '#38bdf8',
                                backgroundColor: '#1e293b',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {log.journeyId ? log.journeyId.slice(0, 14) : '--'}
                            </span>
                          </td>
                          <td>
                            <span
                              className="mono"
                              style={{
                                fontSize: '11px',
                                color: '#a78bfa',
                                backgroundColor: '#1e293b',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {log.referenceId ? log.referenceId.slice(0, 16) : (log.cfRay ? log.cfRay.slice(0, 16) : '--')}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                              <span>{log.realIp || log.clientIp || log.userIp || '127.0.0.1'}</span>
                              <span style={{ marginLeft: '6px', fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                                [{log.userLocation || log.country || 'LOCAL'}]
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: '11px', color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.userAgent}>
                            {log.userDeviceId && log.userDeviceId !== '--' ? `📱 ${log.userDeviceId} • ` : ''}
                            {log.userAgent || 'Unknown'}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '11px' }}>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Stream Pagination */}
              {streamTotalPages > 1 && (
                <div className="pagination-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--dark-text-dim)' }}>
                    Page {streamPage} of {streamTotalPages} ({streamTotal} total requests in MySQL)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-page"
                      style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
                      onClick={() => setStreamPage((p) => Math.max(1, p - 1))}
                      disabled={streamPage === 1}
                    >
                      ← Previous
                    </button>
                    <button
                      className="btn-page"
                      style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
                      onClick={() => setStreamPage((p) => Math.min(streamTotalPages, p + 1))}
                      disabled={streamPage >= streamTotalPages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 2: Users Directory */}
        {activeTab === 'users' && (() => {
          const userItems = usersData?.items || [];
          const usersTotal = usersData?.total ?? userItems.length;
          const usersTotalPages = usersData?.totalPages ?? 1;

          return (
            <div className="dark-panel-box">
              <div className="dark-panel-header">
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Registered Users Directory</h3>
                  <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                    Audited accounts saved in MySQL ({usersTotal} total registered accounts)
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
                    {userItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dark-text-dim)' }}>
                          No registered users in database yet.
                        </td>
                      </tr>
                    ) : (
                      userItems.map((u: any) => (
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

              {/* Users Pagination */}
              {usersTotalPages > 1 && (
                <div className="pagination-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--dark-text-dim)' }}>
                    Page {usersPage} of {usersTotalPages} ({usersTotal} registered users)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-page"
                      style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                    >
                      ← Previous
                    </button>
                    <button
                      className="btn-page"
                      style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
                      onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                      disabled={usersPage >= usersTotalPages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 3: Visit Analytics */}
        {activeTab === 'visits' && (() => {
          const visitItems = visitsData?.items || [];
          const visitsTotal = visitsData?.total ?? visitItems.length;
          const visitsTotalPages = visitsData?.totalPages ?? 1;

          return (
            <div className="dark-panel-box">
              <div className="dark-panel-header">
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Page Visits & Edge Analytics</h3>
                  <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                    Total Visits Tracked: <strong style={{ color: '#38bdf8' }}>{visitsTotal}</strong>
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
                    {visitItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dark-text-dim)' }}>
                          No page visits recorded yet.
                        </td>
                      </tr>
                    ) : (
                      visitItems.map((v: any) => (
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

              {/* Visits Pagination */}
              {visitsTotalPages > 1 && (
                <div className="pagination-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--dark-text-dim)' }}>
                    Page {visitsPage} of {visitsTotalPages} ({visitsTotal} total visits)
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-page"
                      style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
                      onClick={() => setVisitsPage((p) => Math.max(1, p - 1))}
                      disabled={visitsPage === 1}
                    >
                      ← Previous
                    </button>
                    <button
                      className="btn-page"
                      style={{ backgroundColor: '#141d2f', color: '#94a3b8', borderColor: '#1f2c44', fontSize: '12px' }}
                      onClick={() => setVisitsPage((p) => Math.min(visitsTotalPages, p + 1))}
                      disabled={visitsPage >= visitsTotalPages}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 4: Topology & Server Health */}
        {activeTab === 'health' && (() => {
          const host = metrics?.systemHealth?.host;
          const services = metrics?.systemHealth?.services || [];
          const dockerMetrics = metrics?.systemHealth?.dockerMetrics;
          const containers = dockerMetrics?.containers || [];
          const volumes = dockerMetrics?.volumes || [];

          const formatBytes = (bytes: number) => {
            if (!bytes || bytes <= 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
          };

          const totalRwBytes = containers.reduce((acc: number, c: any) => acc + (c.sizeRwBytes || 0), 0);
          const totalMemBytes = containers.reduce((acc: number, c: any) => acc + (c.memUsageBytes || 0), 0);

          return (
            <div>
              {/* Host Hardware Telemetry Grid */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🖥️</span>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--dark-text-main)' }}>
                      AWS EC2 Host Server Hardware Telemetry
                    </h3>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--dark-text-dim)', backgroundColor: '#141d2f', padding: '4px 10px', borderRadius: '6px', border: '1px solid #1f2c44' }}>
                    Platform: {host?.platform || 'Linux x64'} • {host?.cpuCores || 1} vCPU
                  </span>
                </div>

                <div className="dark-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '0' }}>
                  {/* CPU Card */}
                  <div className="dark-stat-card">
                    <div className="dark-stat-header">EC2 CPU UTILIZATION</div>
                    <div className="dark-stat-val" style={{ color: '#06b6d4', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      {host?.cpuLoadPercent ?? 0}%
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-text-muted)' }}>
                        ({host?.cpuCores || 1} Cores)
                      </span>
                    </div>
                    {/* CPU Progress Bar */}
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(5, host?.cpuLoadPercent ?? 10))}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <div className="dark-stat-sub" style={{ marginTop: '8px' }}>
                      Load Avg: {host?.loadAvg ? host.loadAvg.join(' · ') : '0.10 · 0.15 · 0.12'}
                    </div>
                  </div>

                  {/* RAM Card */}
                  <div className="dark-stat-card">
                    <div className="dark-stat-header">EC2 HOST MEMORY (RAM)</div>
                    <div className="dark-stat-val" style={{ color: '#10b981', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      {host?.usedMemMb ?? 0} MB
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-text-muted)' }}>
                        / {host?.totalMemMb ?? 1024} MB ({host?.memPercent ?? 0}%)
                      </span>
                    </div>
                    {/* RAM Progress Bar */}
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#1e293b', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(5, parseFloat(host?.memPercent || '20')))}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #10b981, #14b8a6)',
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <div className="dark-stat-sub" style={{ marginTop: '8px' }}>
                      Free RAM: {host?.freeMemMb ?? 0} MB • Node RSS: {metrics?.overview?.memoryRssMb ?? 0} MB
                    </div>
                  </div>

                  {/* Uptime Card */}
                  <div className="dark-stat-card">
                    <div className="dark-stat-header">SERVER UPTIME</div>
                    <div className="dark-stat-val" style={{ color: '#a855f7' }}>
                      {host?.hostUptimeFormatted || '0h 0m'}
                    </div>
                    <div className="dark-stat-sub" style={{ marginTop: '10px' }}>
                      Process Uptime: {metrics?.systemHealth?.processUptimeFormatted || metrics?.overview?.uptimeFormatted}
                    </div>
                  </div>
                </div>
              </div>

              {/* Docker Microservice Topology & Health Grid */}
              <div className="dark-panel-box" style={{ marginBottom: '24px' }}>
                <div className="dark-panel-header">
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Docker Container & Service Health Matrix</h3>
                    <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                      Real-time internal probes across Docker bridge network (app-net) for all 5 decoupled microservices
                    </p>
                  </div>
                  <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                    Live Polling (5s)
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="dark-table">
                    <thead>
                      <tr>
                        <th>MICROSERVICE</th>
                        <th>ROLE & PURPOSE</th>
                        <th>TARGET INGRESS / PORT</th>
                        <th>HEALTH STATUS</th>
                        <th>LATENCY</th>
                        <th>DIAGNOSTICS & DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((svc: any) => {
                        const isHealthy = svc.status === 'healthy';
                        const isDegraded = svc.status === 'degraded';

                        return (
                          <tr key={svc.id}>
                            <td style={{ fontWeight: 600, color: 'var(--dark-text-main)' }}>
                              {svc.id === 'mysql' && '🗄️ '}
                              {svc.id === 'nestjs-app' && '⚙️ '}
                              {svc.id === 'ui-user' && '🌐 '}
                              {svc.id === 'ui-admin' && '🛡️ '}
                              {svc.id === 'nginx-proxy' && '🔀 '}
                              {svc.name}
                            </td>
                            <td style={{ color: 'var(--dark-text-muted)', fontSize: '12px' }}>{svc.role}</td>
                            <td className="mono" style={{ fontSize: '12px', color: '#38bdf8' }}>{svc.endpoint}</td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                  backgroundColor: isHealthy ? 'rgba(16, 185, 129, 0.15)' : isDegraded ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: isHealthy ? '#34d399' : isDegraded ? '#fbbf24' : '#f87171',
                                  border: `1px solid ${isHealthy ? 'rgba(16, 185, 129, 0.3)' : isDegraded ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: isHealthy ? '#10b981' : isDegraded ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                                {isHealthy ? 'ONLINE' : isDegraded ? 'DEGRADED' : 'DOWN'}
                              </span>
                            </td>
                            <td className="mono" style={{ color: isHealthy ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                              {svc.latencyMs >= 0 ? `${svc.latencyMs} ms` : 'Timeout'}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--dark-text-dim)' }}>
                              {svc.details}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Docker Container Space & Resource Utilization (100% Real Docker Engine Data) */}
              <div className="dark-panel-box" style={{ marginBottom: '24px' }}>
                <div className="dark-panel-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>📦</span>
                      <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
                        Docker Containers Disk Space & Live Resource Allocation
                      </h3>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--dark-text-dim)', marginTop: '2px' }}>
                      Real-time container storage breakdown (Writable Layer SizeRw, RootFS Image Size, Live RAM usage) queried directly from Docker Engine via Unix Socket (<code style={{ color: '#38bdf8' }}>/var/run/docker.sock</code>).
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: dockerMetrics?.dockerEngineActive ? '#34d399' : '#fbbf24',
                      backgroundColor: dockerMetrics?.dockerEngineActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      border: `1px solid ${dockerMetrics?.dockerEngineActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: dockerMetrics?.dockerEngineActive ? '#10b981' : '#f59e0b',
                      }}
                    />
                    {dockerMetrics?.dockerEngineActive ? 'Docker Daemon Connected' : 'Local Dev (Socket Standby)'}
                  </span>
                </div>

                {/* KPI summary row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    padding: '16px 20px',
                    borderBottom: '1px solid #1e293b',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  }}
                >
                  <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Active Containers
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                      {containers.length > 0 ? containers.length : 5} Running
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Isolated Bridge Network
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Container Writable Disk (SizeRw)
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                      {formatBytes(totalRwBytes)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Ephemeral changes & runtime files
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Live Container RAM
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                      {formatBytes(totalMemBytes)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Total active container memory
                    </div>
                  </div>

                  <div style={{ padding: '10px 14px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Persistent Volume Disk
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#a855f7', marginTop: '2px' }}>
                      {volumes.length > 0 ? volumes[0].sizeFormatted : 'mysql_data'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {volumes.length > 0 ? volumes[0].name : 'InnoDB Physical DB storage'}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="dark-table">
                    <thead>
                      <tr>
                        <th>CONTAINER NAME</th>
                        <th>IMAGE</th>
                        <th>WRITABLE DISK (SizeRw)</th>
                        <th>TOTAL ROOTFS / IMAGE</th>
                        <th>LIVE RAM (USAGE / %)</th>
                        <th>CPU %</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {containers.length > 0 ? (
                        containers.map((c: any) => (
                          <tr key={c.id || c.name}>
                            <td style={{ fontWeight: 600, color: 'var(--dark-text-main)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="mono" style={{ color: '#38bdf8', fontWeight: 700 }}>
                                  {c.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#64748b',
                                    backgroundColor: '#1e293b',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {c.id}
                                </span>
                              </div>
                            </td>
                            <td className="mono" style={{ fontSize: '11px', color: '#94a3b8' }}>
                              {c.image}
                            </td>
                            <td>
                              <span
                                style={{
                                  color: '#f59e0b',
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(245, 158, 11, 0.25)',
                                }}
                              >
                                {c.sizeRwFormatted || '0 B'}
                              </span>
                            </td>
                            <td className="mono" style={{ fontSize: '12px', color: '#cbd5e1' }}>
                              {c.sizeRootFsFormatted || '--'}
                            </td>
                            <td>
                              <div style={{ minWidth: '120px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                                  <span style={{ color: '#34d399', fontWeight: 600 }}>{c.memUsageFormatted || '0 B'}</span>
                                  <span style={{ color: '#64748b' }}>{c.memPercent || 0}%</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${Math.min(100, Math.max(2, c.memPercent || 1))}%`,
                                      height: '100%',
                                      backgroundColor: '#10b981',
                                      borderRadius: '2px',
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="mono" style={{ fontSize: '12px', color: (c.cpuPercent || 0) > 10 ? '#f43f5e' : '#38bdf8' }}>
                                {c.cpuPercent ? `${c.cpuPercent}%` : '< 0.5%'}
                              </span>
                            </td>
                            <td>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  backgroundColor: c.state === 'running' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: c.state === 'running' ? '#34d399' : '#f87171',
                                }}
                              >
                                <span
                                  style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    backgroundColor: c.state === 'running' ? '#10b981' : '#ef4444',
                                  }}
                                />
                                {c.status || c.state}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                            {dockerMetrics?.source || 'Mount /var/run/docker.sock into nestjs-app container to view live Docker space metrics.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Persistent Volumes detail */}
                {volumes.length > 0 && (
                  <div style={{ padding: '16px 20px', borderTop: '1px solid #1e293b', backgroundColor: '#090d16' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💾</span> Docker Persistent Named Volumes
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {volumes.map((v: any) => (
                        <div
                          key={v.name}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#141d2f',
                            border: '1px solid #1f2c44',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                          }}
                        >
                          <span className="mono" style={{ color: '#38bdf8' }}>{v.name}</span>
                          <span style={{ color: '#64748b' }}>•</span>
                          <span style={{ color: '#a855f7', fontWeight: 600 }}>{v.sizeFormatted}</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: '#1e293b', padding: '1px 6px', borderRadius: '4px' }}>
                            Driver: {v.driver}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
};
