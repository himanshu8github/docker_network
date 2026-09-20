'use client';

import React from 'react';
import { DeploymentItem } from './TabDeployments';

interface TabInsightsProps {
  insights: DeploymentItem[];
  loading: boolean;
  onOpenModal: () => void;
}

export const TabInsights: React.FC<TabInsightsProps> = ({
  insights,
  loading,
  onOpenModal,
}) => {
  return (
    <div className="content-panel">
      <div className="section-box">
        <div className="section-header">
          <div>
            <h2 className="section-title">DevOps Architecture Notes & TIL (DevPulse)</h2>
            <p className="section-sub">
              Engineering takeaways, network isolation strategies, and edge security lessons learned
            </p>
          </div>

          <button className="btn-primary" onClick={onOpenModal}>
            + Log Architecture Note
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Loading architecture insights...
          </div>
        ) : insights.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
            No architecture notes logged yet. Click &quot;+ Log Architecture Note&quot; to add one!
          </div>
        ) : (
          <div className="insights-grid">
            {insights.map((item) => {
              const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div key={item.id} className="insight-card">
                  <div>
                    <span className="insight-tag">#{item.category}</span>
                    <h3 className="insight-title" style={{ marginTop: '8px' }}>
                      {item.title}
                    </h3>
                  </div>

                  <p className="insight-body">{item.message}</p>

                  <div className="feed-meta" style={{ justifyContent: 'space-between' }}>
                    <span>{item.author}</span>
                    <span className="mono">{dateStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
