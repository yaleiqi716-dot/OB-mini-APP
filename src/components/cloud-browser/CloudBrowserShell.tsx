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
  const sessionLabel = sessionId ? `会话 ${sessionId}` : '未创建会话';
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
          <p>NEKO 会话工作台 · 地区：{t.cloudBrowser.region} · {isMockSession ? '当前为前端模拟状态' : '会话 ID 已接入路由参数'}</p>
        </div>
      }
      rightRail={
        <div className="ob-grid-gap">
          <Panel title={t.cloudBrowser.panels.controls} description="create / reconnect / end 接口边界">
            <div className="ob-chip-row">
              <ActionChip>创建会话</ActionChip>
              <ActionChip>重连会话</ActionChip>
              <ActionChip>结束会话</ActionChip>
            </div>
            <div className="ob-control-buttons">
              <button className="ob-solid-btn" onClick={handleCreateSession}>创建会话</button>
              <button className="ob-outline-btn" onClick={handleReconnect}>重连</button>
              <button className="ob-outline-btn" onClick={handleEnd}>结束</button>
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

          <Panel title={t.cloudBrowser.panels.statusUsage} description="模拟计时与 usage，后续接真实计费">
            <StatusPill>{t.cloudBrowser.states[state]}</StatusPill>
            <p className="ob-panel-hint">会话时长：{toDisplayTime(seconds)}</p>
            <p className="ob-panel-hint">配额使用：{usagePercent}%</p>
            <div className="ob-usage-track"><div className="ob-usage-fill" style={{ width: `${usagePercent}%` }} /></div>
          </Panel>

          <Panel title={t.cloudBrowser.panels.taskMount} description="自动化任务进入云浏览器执行链路">
            <p className="ob-panel-hint">Future hook：任务队列、浏览器动作回放、结果回传。</p>
          </Panel>
        </div>
      }
    >
      <div className="ob-grid-gap">
        <div className="ob-browser-bar">
          <strong>{sessionLabel}</strong>
          <StatusPill>{t.cloudBrowser.states[state]}</StatusPill>
          <span>地区：{t.cloudBrowser.region}</span>
          <span>设备：{t.cloudBrowser.devices[device]}</span>
          {sessionId ? (
            <Link href="/cloud-browser" className="ob-mini-link">返回会话大厅</Link>
          ) : (
            <Link href={`/cloud-browser/${currentSessionId}`} className="ob-mini-link">进入会话页（模拟）</Link>
          )}
        </div>

        <div className={`ob-browser-viewport ob-browser-viewport--${device}`}>
          <div>
            <p>{sessionId ? `会话视口：${sessionId}` : '会话大厅视口'}</p>
            <p className="ob-panel-hint">NEKO 容器稳定挂载位（当前未接真实容器，仅前端结构）。</p>
          </div>
        </div>

        <Panel title="会话信息" description={sessionId ? 'session 路由态：真实 URL 参数驱动' : '大厅态：未创建会话'}>
          <div className="ob-browser-info-grid">
            <div><span>会话 ID</span><strong>{currentSessionId}</strong></div>
            <div><span>会话状态</span><strong>{t.cloudBrowser.states[state]}</strong></div>
            <div><span>接入类型</span><strong>{isMockSession ? '前端 mock state' : '路由态 + mock state'}</strong></div>
            <div><span>未来扩展</span><strong>create / reconnect / end / usage</strong></div>
          </div>
        </Panel>
      </div>
    </ProductShell>
  );
}
