'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getMessages } from '@/lib/i18n';
import { ProductShell, Panel, SegmentControl, StatusPill, ActionChip } from '@/components/product-shell/ProductShell';

type SessionState = 'ready' | 'booting' | 'active' | 'ended';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const t = getMessages('zh-CN');

function toDisplayTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function CloudBrowserShell({ sessionId }: { sessionId?: string }) {
  const [state, setState] = useState<SessionState>(sessionId ? 'active' : 'ready');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [seconds, setSeconds] = useState(sessionId ? 132 : 0);
  const [usagePercent, setUsagePercent] = useState(sessionId ? 32 : 0);

  useEffect(() => {
    if (state !== 'active') return;
    const iv = setInterval(() => {
      setSeconds((prev) => prev + 1);
      setUsagePercent((prev) => Math.min(prev + 1, 100));
    }, 1000);
    return () => clearInterval(iv);
  }, [state]);

  const currentSessionId = useMemo(() => sessionId || `demo-${new Date().getTime().toString().slice(-6)}`, [sessionId]);
  const sessionLabel = sessionId ? `${t.cloudBrowser.labels.session} ${sessionId}` : t.cloudBrowser.labels.lobby;
  const isMockSession = !sessionId;

  function handleCreateSession() {
    setState('booting');
    setTimeout(() => {
      setState('active');
      setSeconds(0);
      setUsagePercent(3);
    }, 1200);
  }

  function handleReconnect() {
    setState('booting');
    setTimeout(() => setState('active'), 900);
  }

  function handleEnd() {
    setState('ended');
  }

  return (
    <ProductShell
      hero={
        <div>
          <h1>{t.cloudBrowser.title}</h1>
          <p>{t.cloudBrowser.subtitle} · {t.cloudBrowser.labels.region}：{t.cloudBrowser.region}</p>
        </div>
      }
      rightRail={
        <div className="ob-grid-gap">
          <Panel title={t.cloudBrowser.panels.controls} description="create / reconnect / end 接口边界">
            <div className="ob-chip-row">
              <ActionChip>{t.cloudBrowser.controls.create}</ActionChip>
              <ActionChip>{t.cloudBrowser.controls.reconnect}</ActionChip>
              <ActionChip>{t.cloudBrowser.controls.end}</ActionChip>
            </div>
            <div className="ob-control-buttons">
              <button className="ob-solid-btn" onClick={handleCreateSession}>{t.cloudBrowser.controls.create}</button>
              <button className="ob-outline-btn" onClick={handleReconnect}>{t.cloudBrowser.controls.reconnect}</button>
              <button className="ob-outline-btn" onClick={handleEnd}>{t.cloudBrowser.controls.end}</button>
            </div>
          </Panel>

          <Panel title={t.cloudBrowser.panels.deviceView} description="桌面 / 平板 / 手机">
            <SegmentControl
              value={device}
              onChange={(value) => setDevice(value as DeviceMode)}
              options={[
                { value: 'desktop', label: t.cloudBrowser.devices.desktop },
                { value: 'tablet', label: t.cloudBrowser.devices.tablet },
                { value: 'mobile', label: t.cloudBrowser.devices.mobile },
              ]}
            />
          </Panel>

          <Panel title={t.cloudBrowser.panels.statusUsage} description={`${t.common.duration} / ${t.common.quotaUsage} · ${t.common.usageSummary}`}>
            <StatusPill>{t.cloudBrowser.states[state]}</StatusPill>
            <p className="ob-panel-hint">{t.common.duration}：{toDisplayTime(seconds)}</p>
            <p className="ob-panel-hint">{t.common.quotaUsage}：{usagePercent}%</p>
            <div className="ob-usage-track"><div className="ob-usage-fill" style={{ width: `${usagePercent}%` }} /></div>
          </Panel>

          <Panel title={t.cloudBrowser.panels.taskMount} description="自动化任务进入云浏览器执行链路">
            <p className="ob-panel-hint">后续接入：任务队列、浏览器动作回放、结果回传。</p>
          </Panel>
        </div>
      }
    >
      <div className="ob-grid-gap">
        <div className="ob-browser-bar">
          <strong>{sessionLabel}</strong>
          <StatusPill>{t.cloudBrowser.states[state]}</StatusPill>
          <span>{t.cloudBrowser.labels.region}：{t.cloudBrowser.region}</span>
          <span>{t.cloudBrowser.labels.device}：{t.cloudBrowser.devices[device]}</span>
          {sessionId ? (
            <Link href="/cloud-browser" className="ob-mini-link">{t.cloudBrowser.labels.returnLobby}</Link>
          ) : (
            <Link href={`/cloud-browser/${currentSessionId}`} className="ob-mini-link">{t.cloudBrowser.labels.enterSession}</Link>
          )}
        </div>

        <div className={`ob-browser-viewport ob-browser-viewport--${device}`}>
          <div>
            <p>{sessionId ? `${t.cloudBrowser.labels.viewportSession}：${sessionId}` : t.cloudBrowser.labels.viewportLobby}</p>
            <p className="ob-panel-hint">NEKO 容器稳定挂载位（当前未接真实容器，仅前端结构）。</p>
          </div>
        </div>

        <Panel title={t.cloudBrowser.panels.sessionInfo} description={sessionId ? `${t.cloudBrowser.labels.session} route：${t.cloudBrowser.labels.routeDriven}` : `${t.cloudBrowser.labels.lobby}：${t.cloudBrowser.labels.mockState}`}>
          <div className="ob-browser-info-grid">
            <div><span>{t.cloudBrowser.labels.session}</span><strong>{currentSessionId}</strong></div>
            <div><span>{t.common.currentStatus}</span><strong>{t.cloudBrowser.states[state]}</strong></div>
            <div><span>{t.cloudBrowser.labels.accessType}</span><strong>{isMockSession ? t.cloudBrowser.labels.mockState : t.cloudBrowser.labels.routeAndMock}</strong></div>
            <div><span>{t.cloudBrowser.labels.extension}</span><strong>create / reconnect / end / usage</strong></div>
          </div>
        </Panel>
      </div>
    </ProductShell>
  );
}
