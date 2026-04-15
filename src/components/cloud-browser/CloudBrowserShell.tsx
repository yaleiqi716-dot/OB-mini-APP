'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getMessages } from '@/lib/i18n';
import { ProductShell, Panel, SegmentControl, StatusPill, ActionChip, EmptyState } from '@/components/product-shell/ProductShell';

type SessionState = 'ready' | 'booting' | 'active' | 'ended';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface CloudSessionView {
  sessionId: string;
  status: SessionState;
  region: string;
  deviceMode: DeviceMode;
  duration: number;
  usagePercent: number;
  isMock: boolean;
  lastUpdated: string;
  errorMessage?: string;
}

interface CloudBrowserAdapter {
  createSession(): Promise<CloudSessionView>;
  reconnectSession(sessionId: string): Promise<CloudSessionView>;
  endSession(sessionId: string): Promise<CloudSessionView>;
  getSessionStatus(sessionId: string): Promise<SessionState>;
  getUsage(sessionId: string): Promise<number>;
  setDeviceMode(sessionId: string, deviceMode: DeviceMode): Promise<DeviceMode>;
}

const t = getMessages('zh-CN');
const DEFAULT_REGION = t.cloudBrowser.region;

function toDisplayTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function toClock(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function makeMockSession(sessionId: string, patch?: Partial<CloudSessionView>): CloudSessionView {
  return {
    sessionId,
    status: 'ready',
    region: DEFAULT_REGION,
    deviceMode: 'desktop',
    duration: 0,
    usagePercent: 0,
    isMock: true,
    lastUpdated: new Date().toISOString(),
    ...patch,
  };
}

const mockAdapter: CloudBrowserAdapter = {
  async createSession() {
    const sessionId = `demo-${Date.now().toString().slice(-6)}`;
    return makeMockSession(sessionId, { status: 'active', usagePercent: 3 });
  },
  async reconnectSession(sessionId) {
    return makeMockSession(sessionId, { status: 'active', usagePercent: 24, duration: 92 });
  },
  async endSession(sessionId) {
    return makeMockSession(sessionId, { status: 'ended', usagePercent: 41, duration: 188 });
  },
  async getSessionStatus() {
    return 'active';
  },
  async getUsage() {
    return Math.floor(Math.random() * 40) + 10;
  },
  async setDeviceMode(_sessionId, deviceMode) {
    return deviceMode;
  },
};

export function CloudBrowserShell({ sessionId, mode = 'lobby' }: { sessionId?: string; mode?: 'lobby' | 'session' }) {
  const adapter = useMemo(() => mockAdapter, []);
  const initialSessionId = useMemo(() => sessionId || `demo-${Date.now().toString().slice(-6)}`, [sessionId]);
  const [session, setSession] = useState<CloudSessionView>(() => makeMockSession(initialSessionId));

  const isSessionPage = mode === 'session';

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!isSessionPage || !sessionId) return;

      setSession((prev) => ({
        ...prev,
        sessionId,
        status: 'booting',
        errorMessage: undefined,
        lastUpdated: new Date().toISOString(),
      }));

      try {
        const status = await adapter.getSessionStatus(sessionId);
        const usage = await adapter.getUsage(sessionId);
        if (cancelled) return;

        setSession((prev) => ({
          ...prev,
          sessionId,
          status,
          usagePercent: usage,
          duration: Math.max(prev.duration, 120),
          lastUpdated: new Date().toISOString(),
          errorMessage: undefined,
        }));
      } catch {
        if (cancelled) return;
        setSession((prev) => ({
          ...prev,
          status: 'ready',
          errorMessage: '会话状态获取失败，请重连会话。',
          lastUpdated: new Date().toISOString(),
        }));
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [adapter, isSessionPage, sessionId]);

  useEffect(() => {
    if (session.status !== 'active') return;

    const timer = setInterval(async () => {
      const usage = await adapter.getUsage(session.sessionId);
      setSession((prev) => ({
        ...prev,
        duration: prev.duration + 1,
        usagePercent: Math.min(Math.max(prev.usagePercent, usage), 100),
        lastUpdated: new Date().toISOString(),
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [adapter, session.sessionId, session.status]);

  async function handleCreateSession() {
    setSession((prev) => ({
      ...prev,
      status: 'booting',
      errorMessage: undefined,
      lastUpdated: new Date().toISOString(),
    }));

    try {
      const next = await adapter.createSession();
      setSession(next);
    } catch {
      setSession((prev) => ({
        ...prev,
        status: 'ready',
        errorMessage: '创建会话失败，请稍后重试。',
        lastUpdated: new Date().toISOString(),
      }));
    }
  }

  async function handleReconnect() {
    setSession((prev) => ({
      ...prev,
      status: 'booting',
      errorMessage: undefined,
      lastUpdated: new Date().toISOString(),
    }));

    try {
      const next = await adapter.reconnectSession(session.sessionId);
      setSession(next);
    } catch {
      setSession((prev) => ({
        ...prev,
        status: 'ready',
        errorMessage: '重连会话失败，请稍后重试。',
        lastUpdated: new Date().toISOString(),
      }));
    }
  }

  async function handleEnd() {
    try {
      const next = await adapter.endSession(session.sessionId);
      setSession(next);
    } catch {
      setSession((prev) => ({
        ...prev,
        errorMessage: '结束会话失败，请稍后重试。',
        lastUpdated: new Date().toISOString(),
      }));
    }
  }

  async function handleDeviceModeChange(value: string) {
    const nextMode = value as DeviceMode;

    try {
      const resolvedMode = await adapter.setDeviceMode(session.sessionId, nextMode);
      setSession((prev) => ({
        ...prev,
        deviceMode: resolvedMode,
        lastUpdated: new Date().toISOString(),
      }));
    } catch {
      setSession((prev) => ({
        ...prev,
        errorMessage: '设备模式切换失败，请稍后重试。',
        lastUpdated: new Date().toISOString(),
      }));
    }
  }

  return (
    <ProductShell
      hero={
        <div>
          <h1>{t.cloudBrowser.title}</h1>
          <p>
            {isSessionPage ? t.cloudBrowser.subtitleSession : t.cloudBrowser.subtitleLobby} · {t.cloudBrowser.labels.region}：
            {session.region} · {t.cloudBrowser.labels.mockMode}：{t.cloudBrowser.labels.interfaceReady}
          </p>
        </div>
      }
      rightRail={
        <div className="ob-grid-gap">
          <Panel title={t.cloudBrowser.panels.controls} description={t.cloudBrowser.hints.controlBoundary}>
            <div className="ob-chip-row">
              <ActionChip>{t.cloudBrowser.controls.create}</ActionChip>
              <ActionChip>{t.cloudBrowser.controls.reconnect}</ActionChip>
              <ActionChip>{t.cloudBrowser.controls.end}</ActionChip>
            </div>
            <div className="ob-control-buttons">
              <button className="ob-solid-btn" onClick={handleCreateSession}>
                {t.cloudBrowser.controls.create}
              </button>
              <button className="ob-outline-btn" onClick={handleReconnect}>
                {t.cloudBrowser.controls.reconnect}
              </button>
              <button className="ob-outline-btn" onClick={handleEnd}>
                {t.cloudBrowser.controls.end}
              </button>
            </div>
          </Panel>

          <Panel title={t.cloudBrowser.panels.deviceView} description={t.cloudBrowser.hints.deviceBoundary}>
            <SegmentControl
              value={session.deviceMode}
              onChange={handleDeviceModeChange}
              options={[
                { value: 'desktop', label: t.cloudBrowser.devices.desktop },
                { value: 'tablet', label: t.cloudBrowser.devices.tablet },
                { value: 'mobile', label: t.cloudBrowser.devices.mobile },
              ]}
            />
          </Panel>

          <Panel title={t.cloudBrowser.panels.statusUsage} description={t.common.usageSummary}>
            <StatusPill>{t.cloudBrowser.states[session.status]}</StatusPill>
            <p className="ob-panel-hint">
              {t.cloudBrowser.labels.duration}：{toDisplayTime(session.duration)}
            </p>
            <p className="ob-panel-hint">
              {t.cloudBrowser.labels.usagePercent}：{session.usagePercent}%
            </p>
            <div className="ob-usage-track">
              <div className="ob-usage-fill" style={{ width: `${session.usagePercent}%` }} />
            </div>
          </Panel>

          <Panel title={t.cloudBrowser.panels.taskMount} description={t.cloudBrowser.hints.taskMount}>
            <p className="ob-panel-hint">{t.cloudBrowser.hints.mockBoundary}</p>
          </Panel>
        </div>
      }
    >
      <div className="ob-grid-gap">
        <div className="ob-browser-bar">
          <strong>{isSessionPage ? `${t.cloudBrowser.labels.session} ${session.sessionId}` : t.cloudBrowser.labels.lobby}</strong>
          <StatusPill>{t.cloudBrowser.states[session.status]}</StatusPill>
          <span>
            {t.cloudBrowser.labels.region}：{session.region}
          </span>
          <span>
            {t.cloudBrowser.labels.device}：{t.cloudBrowser.devices[session.deviceMode]}
          </span>
          {isSessionPage ? (
            <Link href="/cloud-browser" className="ob-mini-link">
              {t.cloudBrowser.labels.returnLobby}
            </Link>
          ) : (
            <Link href={`/cloud-browser/${session.sessionId}`} className="ob-mini-link">
              {t.cloudBrowser.labels.enterSession}
            </Link>
          )}
        </div>

        <div className={`ob-browser-viewport ob-browser-viewport--${session.deviceMode}`}>
          <div>
            <p>{isSessionPage ? `${t.cloudBrowser.labels.viewportSession}：${session.sessionId}` : t.cloudBrowser.labels.viewportLobby}</p>
            <p className="ob-panel-hint">{t.cloudBrowser.hints.viewport}</p>
          </div>
        </div>

        <Panel title={t.cloudBrowser.panels.sessionInfo} description={isSessionPage ? t.cloudBrowser.labels.routeDriven : t.cloudBrowser.labels.lobby}>
          <div className="ob-browser-info-grid">
            <div>
              <span>{t.cloudBrowser.labels.sessionId}</span>
              <strong>{session.sessionId}</strong>
            </div>
            <div>
              <span>{t.common.currentStatus}</span>
              <strong>{t.cloudBrowser.states[session.status]}</strong>
            </div>
            <div>
              <span>{t.cloudBrowser.labels.mockMode}</span>
              <strong>{session.isMock ? t.cloudBrowser.labels.interfaceReady : t.cloudBrowser.labels.routeAndMock}</strong>
            </div>
            <div>
              <span>{t.cloudBrowser.labels.lastUpdated}</span>
              <strong>{toClock(session.lastUpdated)}</strong>
            </div>
          </div>
        </Panel>

        {session.errorMessage ? (
          <Panel title={t.cloudBrowser.labels.error} description={t.cloudBrowser.hints.mockBoundary}>
            <EmptyState title={t.cloudBrowser.labels.error} description={session.errorMessage} />
          </Panel>
        ) : null}
      </div>
    </ProductShell>
  );
}
