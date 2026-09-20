'use client';

import React, { useState } from 'react';

export interface DeploymentItem {
  id: number;
  tab: string;
  title: string;
  message: string;
  status: string;
  category: string;
  environment: string;
  author: string;
  createdAt: string;
}

interface TabDeploymentsProps {
  items: DeploymentItem[];
  loading: boolean;
}

export const TabDeployments: React.FC<TabDeploymentsProps> = ({ items, loading }) => {
  const [filter, setFilter] = useState<'all' | 'deployed' | 'incident'>('all');

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'deployed') return item.status === 'deployed';
    if (filter === 'incident')
      return item.status === 'investigating' || item.status === 'degraded' || item.status === 'resolved';
    return true;
  });

  return (
    <div className="content-panel">
      {/* Metrics Row */}
      <div className="metrics-grid" style={{ margin: '0 0 24px 0' }}>
        <div className="metric-card">
          <div className="metric-header">ACTIVE HOST</div>
          <div className="metric-val white">AWS EC2 (Elastic IP)</div>
          <div className="progress-track">
            <div className="progress-bar green" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">EDGE REVERSE PROXY</div>
          <div className="metric-val blue">Nginx Alpine (:80 ➔ :3000)</div>
          <div className="progress-track">
            <div className="progress-bar blue" style={{ width: '85%' }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">CLOUDFLARE WAF</div>
          <div className="metric-val orange">Bot Fight Mode Active</div>
          <div className="progress-track">
            <div className="progress-bar orange" style={{ width: '92%' }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">DATABASE ISOLATION</div>
          <div className="metric-val green">Port 3306 (Docker Net)</div>
          <div className="progress-track">
            <div className="progress-bar green" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>

      {/* Feed Box */}
      <div className="section-box">
        <div className="section-header">
          <div>
            <h2 className="section-title">Production Deployment & Incident Stream</h2>
            <p className="section-sub">
              Live audit stream of container updates, reverse proxy changes, and incident resolutions
            </p>
          </div>

          <div className="filter-group">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${filter === 'deployed' ? 'active' : ''}`}
              onClick={() => setFilter('deployed')}
            >
              Deployments
            </button>
            <button
              className={`filter-btn ${filter === 'incident' ? 'active' : ''}`}
              onClick={() => setFilter('incident')}
            >
              Incidents
            </button>
          </div>
        </div>

        <div className="feed-list">
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
              Loading telemetry stream...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
              No entries recorded in this category yet.
            </div>
          ) : (
            filteredItems.map((item) => {
              const badgeClass =
                item.status === 'deployed'
                  ? 'blue'
                  : item.status === 'operational' || item.status === 'resolved'
                  ? 'green'
                  : item.status === 'investigating'
                  ? 'orange'
                  : 'yellow';

              const dateStr = new Date(item.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div key={item.id} className="feed-item">
                  <div className="feed-top">
                    <h3 className="feed-title">{item.title}</h3>
                    <div className="feed-meta">
                      <span className={`badge ${badgeClass}`}>{item.status}</span>
                      <span className="mono">{dateStr}</span>
                    </div>
                  </div>
                  <p className="feed-desc">{item.message}</p>
                  <div className="feed-meta" style={{ marginTop: '4px' }}>
                    <span className="mono" style={{ color: 'var(--color-blue)' }}>
                      #{item.category}
                    </span>
                    <span>•</span>
                    <span>Env: {item.environment}</span>
                    <span>•</span>
                    <span>By: {item.author}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
