'use client';

import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  incidentCount: number;
  insightCount: number;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  incidentCount,
  insightCount,
  isOpen,
  onCloseMobile,
}) => {
  const handleNavClick = (tabKey: string) => {
    setActiveTab(tabKey);
    onCloseMobile();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-logo">
          <span className="pulse-dot"></span>
          <h1 className="brand-name">
            CloudOps<span>.hub</span>
          </h1>
        </div>
        <p className="brand-sub">AWS EC2 • NGINX • CLOUDFLARE</p>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-button ${activeTab === 'deployments' ? 'active' : ''}`}
          onClick={() => handleNavClick('deployments')}
        >
          <div className="nav-left">
            <span className="nav-icon">🚀</span>
            <span>Deployments & Incidents</span>
          </div>
          <span className="badge blue">{incidentCount}</span>
        </button>

        <button
          className={`nav-button ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => handleNavClick('insights')}
        >
          <div className="nav-left">
            <span className="nav-icon">💡</span>
            <span>Architecture Insights</span>
          </div>
          <span className="badge yellow">{insightCount}</span>
        </button>

        <button
          className={`nav-button ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => handleNavClick('telemetry')}
        >
          <div className="nav-left">
            <span className="nav-icon">📊</span>
            <span>Edge Telemetry & SLA</span>
          </div>
          <span className="badge green">Live</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="infra-status-box">
          <span>🟢</span>
          <span>All Systems Operational</span>
        </div>
        <div className="infra-tags">
          <span className="infra-pill">Cloudflare 🟠</span>
          <span className="infra-pill">Nginx :80</span>
          <span className="infra-pill">MySQL :3306</span>
        </div>
      </div>
    </aside>
  );
};
