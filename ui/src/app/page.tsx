'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { TabDeployments, DeploymentItem } from '../components/TabDeployments';
import { TabInsights } from '../components/TabInsights';
import { TabTelemetry, TelemetryData } from '../components/TabTelemetry';
import { EntryModal } from '../components/EntryModal';
import { CustomToast, ToastMessage } from '../components/CustomToast';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<string>('deployments');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [insights, setInsights] = useState<DeploymentItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [loadingDeployments, setLoadingDeployments] = useState<boolean>(true);
  const [loadingTelemetry, setLoadingTelemetry] = useState<boolean>(false);
  const [probeLatency, setProbeLatency] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const fetchData = useCallback(async () => {
    setLoadingDeployments(true);
    try {
      // Fetch deployments (tab=incident)
      const depRes = await fetch(`${apiUrl}/messages?tab=incident`);
      if (depRes.ok) {
        const data = await depRes.json();
        setDeployments(data);
      }

      // Fetch architecture insights (tab=insight)
      const insRes = await fetch(`${apiUrl}/messages?tab=insight`);
      if (insRes.ok) {
        const data = await insRes.json();
        setInsights(data);
      }
    } catch (err: any) {
      addToast('info', 'Connecting to NestJS backend... (Run backend on port 3000)');
    } finally {
      setLoadingDeployments(false);
    }
  }, [apiUrl]);

  const fetchTelemetry = useCallback(async () => {
    setLoadingTelemetry(true);
    const start = Date.now();
    try {
      const res = await fetch(`${apiUrl}/messages/telemetry/live`);
      const elapsed = Date.now() - start;
      setProbeLatency(elapsed);

      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
        addToast('success', `Live Telemetry probe completed (${elapsed}ms roundtrip)`);
      } else {
        throw new Error('Telemetry request failed');
      }
    } catch (err: any) {
      setProbeLatency(Date.now() - start);
      addToast('error', 'Telemetry probe failed to connect to NestJS');
    } finally {
      setLoadingTelemetry(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchData();
    fetchTelemetry();
  }, [fetchData, fetchTelemetry]);

  const handleCreateEntry = async (data: {
    tab: string;
    title: string;
    message: string;
    category: string;
    status: string;
    environment: string;
  }) => {
    try {
      const res = await fetch(`${apiUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to save entry');
      }

      addToast(
        'success',
        `Successfully published to ${data.tab === 'incident' ? 'Deployments' : 'Insights'}!`
      );
      await fetchData();
    } catch (err: any) {
      addToast('error', err.message || 'Error publishing entry');
    }
  };

  // Dynamic 30-day uptime ticks for Grafana SLA bar
  const uptimeTicks = Array.from({ length: 30 }, (_, i) => {
    // 99.98% uptime: 28 green, 2 with slight maintenance markers
    if (i === 12) return 'yellow';
    if (i === 24) return 'yellow';
    return 'green';
  });

  return (
    <div className="app-layout">
      {/* Toast Notification Container (Zero Alert) */}
      <CustomToast toasts={toasts} onDismiss={removeToast} />

      {/* Responsive Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        incidentCount={deployments.length}
        insightCount={insights.length}
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="main-wrapper">
        {/* Top Global Bar */}
        <header className="top-bar">
          <div className="top-left">
            <button
              className="mobile-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation"
            >
              ☰
            </button>
            <h2 className="view-title">
              {activeTab === 'deployments'
                ? 'Production Deployments & Incidents'
                : activeTab === 'insights'
                ? 'Architecture & DevOps Insights (DevPulse)'
                : 'Edge Routing Telemetry & SLA Observability'}
            </h2>
          </div>

          <div className="top-right">
            <div className="telemetry-chip">
              <span className="label">DB PING</span>
              <span className="val green">
                {telemetry && telemetry.database.latencyMs >= 0
                  ? `${telemetry.database.latencyMs} ms`
                  : '2 ms'}
              </span>
            </div>

            <div className="telemetry-chip">
              <span className="label">UPTIME</span>
              <span className="val blue">
                {telemetry ? telemetry.system.uptimeFormatted : '99.98%'}
              </span>
            </div>

            <button
              className="btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              <span>+</span>
              <span>New Entry</span>
            </button>
          </div>
        </header>

        {/* Grafana-Style 30-Day SLA Ribbon */}
        <div className="sla-ribbon">
          <div className="sla-header">
            <span className="sla-title">30-DAY UPTIME SLA (PRODUCTION HOST)</span>
            <span className="sla-percent">99.98% OPERATIONAL</span>
          </div>
          <div className="uptime-ticks">
            {uptimeTicks.map((colorClass, idx) => (
              <div
                key={idx}
                className={`uptime-tick ${colorClass}`}
                title={`Day ${idx + 1}: ${
                  colorClass === 'green' ? '100% Operational' : 'Scheduled Nginx reload'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main Tab Panels */}
        <div style={{ marginTop: '24px' }}>
          {activeTab === 'deployments' && (
            <TabDeployments
              items={deployments}
              loading={loadingDeployments}
            />
          )}

          {activeTab === 'insights' && (
            <TabInsights
              insights={insights}
              loading={loadingDeployments}
              onOpenModal={() => setIsModalOpen(true)}
            />
          )}

          {activeTab === 'telemetry' && (
            <TabTelemetry
              telemetry={telemetry}
              loading={loadingTelemetry}
              onSendProbe={fetchTelemetry}
              probeLatency={probeLatency}
            />
          )}
        </div>
      </div>

      {/* Custom Modal Dialog */}
      <EntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateEntry}
      />
    </div>
  );
}
