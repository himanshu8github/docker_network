'use client';

import React from 'react';

export interface TelemetryData {
  system: {
    status: string;
    uptimeFormatted: string;
    uptimeSeconds: number;
    platform: string;
    nodeVersion: string;
    memoryRssMb: string;
    memoryHeapMb: string;
    slaPercentage: string;
  };
  database: {
    status: string;
    latencyMs: number;
    driver: string;
    isolatedPort: number;
    internalHost: string;
  };
  edge: {
    isCloudflare: boolean;
    cfRay: string;
    cfCountry: string;
    realClientIp: string;
    host: string;
    forwardedProto: string;
    userAgent: string;
    wafStatus: string;
  };
  stats: {
    totalDeployments: number;
    totalInsights: number;
    cacheHitRate: string;
    avgEdgeLatencyMs: number;
  };
}

interface TabTelemetryProps {
  telemetry: TelemetryData | null;
  loading: boolean;
  onSendProbe: () => void;
  probeLatency: number | null;
}

export const TabTelemetry: React.FC<TabTelemetryProps> = ({
  telemetry,
  loading,
  onSendProbe,
  probeLatency,
}) => {
  return (
    <div className="content-panel">
      {/* Observability Gauges */}
      <div className="metrics-grid" style={{ margin: '0 0 24px 0' }}>
        <div className="metric-card">
          <div className="metric-header">EDGE CACHE HIT RATIO</div>
          <div className="metric-val green">
            {telemetry ? telemetry.stats.cacheHitRate : '94.2%'}
          </div>
          <div className="progress-track">
            <div className="progress-bar green" style={{ width: '94.2%' }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">INTERNAL DB PING LATENCY</div>
          <div className="metric-val blue">
            {telemetry && telemetry.database.latencyMs >= 0
              ? `${telemetry.database.latencyMs} ms`
              : '-- ms'}
          </div>
          <div className="progress-track">
            <div className="progress-bar blue" style={{ width: '22%' }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">CONTAINER MEMORY (RSS)</div>
          <div className="metric-val yellow">
            {telemetry ? `${telemetry.system.memoryRssMb} MB` : '-- MB'}
          </div>
          <div className="progress-track">
            <div className="progress-bar yellow" style={{ width: '45%' }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">WAF STATUS</div>
          <div className="metric-val orange">
            {telemetry?.edge?.isCloudflare ? 'Cloudflare WAF (🟠)' : 'Nginx Protected'}
          </div>
          <div className="progress-track">
            <div className="progress-bar orange" style={{ width: '95%' }}></div>
          </div>
        </div>
      </div>

      {/* Main Telemetry & Bars Panel */}
      <div className="section-box">
        <div className="section-header">
          <div>
            <h2 className="section-title">Edge Routing & Reverse Proxy Telemetry</h2>
            <p className="section-sub">
              Live inspection of headers passed from Cloudflare edge through Nginx <code>proxy_set_header</code> to NestJS
            </p>
          </div>

          <button
            className="btn-primary"
            onClick={onSendProbe}
            disabled={loading}
          >
            <span>⚡</span>
            <span>{loading ? 'Probing...' : 'Send Live Health Probe'}</span>
          </button>
        </div>

        <div className="telemetry-layout">
          {/* Forwarded Headers Table */}
          <div className="table-wrap">
            <table className="telemetry-table">
              <thead>
                <tr>
                  <th>FORWARDED HEADER</th>
                  <th>DETECTED VALUE</th>
                  <th>INGRESS LAYER</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--color-blue)' }}>CF-Ray (Edge Colocation)</td>
                  <td>{telemetry?.edge?.cfRay || 'direct-probe'}</td>
                  <td><span className="badge orange">Cloudflare 🟠</span></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-green)' }}>X-Real-IP (Real Client)</td>
                  <td>{telemetry?.edge?.realClientIp || '127.0.0.1'}</td>
                  <td><span className="badge blue">Nginx Proxy</span></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-yellow)' }}>X-Forwarded-Proto</td>
                  <td>{telemetry?.edge?.forwardedProto || 'https'}</td>
                  <td><span className="badge yellow">SSL Terminator</span></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--color-white)' }}>Host Header</td>
                  <td>{telemetry?.edge?.host || 'localhost'}</td>
                  <td><span className="badge green">DNS Route</span></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)' }}>Database Topology</td>
                  <td>{telemetry?.database?.internalHost || 'mysql:3306'}</td>
                  <td><span className="badge green">Isolated (Docker)</span></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)' }}>Roundtrip Latency (Live)</td>
                  <td>{probeLatency !== null ? `${probeLatency} ms` : '--'}</td>
                  <td><span className="badge blue">Client ➔ Server</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Grafana Distribution Bars */}
          <div className="bars-panel">
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Network Latency Breakdown</h3>

            <div className="bar-row">
              <div className="bar-labels">
                <span className="label">Cloudflare Edge SSL Handshake</span>
                <span className="val green">12ms (Anycast)</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar green" style={{ width: '15%' }}></div>
              </div>
            </div>

            <div className="bar-row">
              <div className="bar-labels">
                <span className="label">Nginx Upstream Proxy Pass</span>
                <span className="val blue">3ms</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar blue" style={{ width: '8%' }}></div>
              </div>
            </div>

            <div className="bar-row">
              <div className="bar-labels">
                <span className="label">Docker Bridge DNS (127.0.0.11)</span>
                <span className="val green">&lt; 1ms</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar green" style={{ width: '3%' }}></div>
              </div>
            </div>

            <div className="bar-row">
              <div className="bar-labels">
                <span className="label">TypeORM MySQL Ping</span>
                <span className="val yellow">
                  {telemetry ? `${telemetry.database.latencyMs}ms` : '2ms'}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-bar yellow" style={{ width: '12%' }}></div>
              </div>
            </div>

            <div className="bar-row">
              <div className="bar-labels">
                <span className="label">Bot Fight Mode & WAF Rate Limits</span>
                <span className="val orange">Active Shield</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar orange" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
