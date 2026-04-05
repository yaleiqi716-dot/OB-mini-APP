'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/workspace/AppHeader';

type Section = 'profile' | 'preferences' | 'notifications' | 'security' | 'integrations';

const NAV_ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: 'profile', label: '个人资料', icon: 'user' },
  { id: 'preferences', label: '偏好设置', icon: 'sliders' },
  { id: 'notifications', label: '通知', icon: 'bell' },
  { id: 'security', label: '安全', icon: 'shield' },
  { id: 'integrations', label: '连接与集成', icon: 'plug' },
];

function NavIcon({ name }: { name: string }) {
  const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'user') return <svg {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if (name === 'sliders') return <svg {...s}><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>;
  if (name === 'bell') return <svg {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (name === 'shield') return <svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  if (name === 'plug') return <svg {...s}><path d="M12 2v6"/><path d="M6 6v6a6 6 0 0 0 12 0V6"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M12 18v4"/></svg>;
  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [section, setSection] = useState<Section>('profile');
  const [toast, setToast] = useState<string | null>(null);
  const [taskDone, setTaskDone] = useState(true);
  const [taskFailed, setTaskFailed] = useState(true);
  const [newFeature, setNewFeature] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); return; }
    setUserId(decodeURIComponent(m[1]));
  }, [router]);

  function handleLogout() {
    document.cookie = 'ob-user-id=; path=/; max-age=0';
    document.cookie = 'ob-session=; path=/; max-age=0';
    router.replace('/login');
  }

  // ── Shared styles ──
  const cardStyle: React.CSSProperties = {
    background: '#1A1A17', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 17, fontWeight: 600, color: '#F0EDE8', margin: '0 0 4px',
  };
  const sectionDesc: React.CSSProperties = {
    fontSize: 13, color: '#6B7280', margin: '0 0 16px',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, padding: '12px 0',
  };
  const rowBorder: React.CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 14, fontWeight: 500, color: '#F0EDE8',
  };
  const sublabelStyle: React.CSSProperties = {
    fontSize: 12, color: '#9CA3AF', marginTop: 2,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 14, color: '#6B7280',
  };
  const actionBtnStyle: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 9999,
    fontSize: 12, fontWeight: 500,
    border: '1px solid rgba(255,255,255,0.06)', background: '#1A1A17',
    color: '#6B7280', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
    transition: 'border-color .2s, background .2s, color .2s',
  };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,107,44,0.3)';
    e.currentTarget.style.background = 'rgba(255,107,44,0.06)';
    e.currentTarget.style.color = '#FF6B2C';
  };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
    e.currentTarget.style.background = '#1A1A17';
    e.currentTarget.style.color = '#6B7280';
  };
  const placeholderTag: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 22, fontSize: 11, fontWeight: 500, color: '#9CA3AF',
    background: '#121210', borderRadius: 9999, padding: '0 10px',
    border: '1px solid rgba(255,255,255,0.06)',
  };
  const switchStyle = (on: boolean): React.CSSProperties => ({
    width: 44, height: 24, borderRadius: 12, border: 'none',
    background: on ? '#FF6B2C' : '#D5D3CE', cursor: 'pointer',
    position: 'relative', transition: 'background .2s',
    flexShrink: 0,
  });
  const switchDot = (on: boolean): React.CSSProperties => ({
    position: 'absolute', top: 2, left: on ? 22 : 2,
    width: 20, height: 20, borderRadius: '50%', background: '#1A1A17',
    transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
  });

  // ── Section renderers ──
  function renderProfile() {
    return (
      <div style={cardStyle}>
        <p style={sectionTitle}>个人资料</p>
        <p style={sectionDesc}>管理你的基本信息</p>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>头像</div>
          </div>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,107,44,0.12)', color: '#FF6B2C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>
            {userId ? userId.slice(0, 1).toUpperCase() : 'U'}
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>邮箱</div>
            <div style={sublabelStyle}>登录账号</div>
          </div>
          <span style={valueStyle}>{userId || '未设置'}</span>
        </div>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>昵称</div>
            <div style={sublabelStyle}>显示名称</div>
          </div>
          <span style={placeholderTag}>即将开放</span>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>当前套餐</div>
            <div style={sublabelStyle}>你的账户类型</div>
          </div>
          <span style={valueStyle}>Free</span>
        </div>
      </div>
    );
  }

  function renderPreferences() {
    return (
      <div style={cardStyle}>
        <p style={sectionTitle}>偏好设置</p>
        <p style={sectionDesc}>自定义你的使用体验</p>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>默认模型</div>
            <div style={sublabelStyle}>Agent 执行时使用的 AI 模型</div>
          </div>
          <span style={placeholderTag}>配置后可用</span>
        </div>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>结果展示偏好</div>
            <div style={sublabelStyle}>控制结果卡的默认显示方式</div>
          </div>
          <span style={placeholderTag}>即将开放</span>
        </div>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>语言偏好</div>
            <div style={sublabelStyle}>界面与 AI 回复语言</div>
          </div>
          <span style={valueStyle}>简体中文</span>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>主题模式</div>
            <div style={sublabelStyle}>浅色 / 深色 / 跟随系统</div>
          </div>
          <span style={placeholderTag}>即将开放</span>
        </div>
      </div>
    );
  }

  function renderNotifications() {

    return (
      <div style={cardStyle}>
        <p style={sectionTitle}>通知</p>
        <p style={sectionDesc}>控制你收到的提醒</p>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>任务完成通知</div>
            <div style={sublabelStyle}>任务执行完成后提醒你</div>
          </div>
          <button style={switchStyle(taskDone)} onClick={() => { setTaskDone(!taskDone); showToast(taskDone ? '已关闭' : '已开启'); }} aria-label="任务完成通知">
            <span style={switchDot(taskDone)} />
          </button>
        </div>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>失败任务提醒</div>
            <div style={sublabelStyle}>任务执行失败时提醒你</div>
          </div>
          <button style={switchStyle(taskFailed)} onClick={() => { setTaskFailed(!taskFailed); showToast(taskFailed ? '已关闭' : '已开启'); }} aria-label="失败任务提醒">
            <span style={switchDot(taskFailed)} />
          </button>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>新功能通知</div>
            <div style={sublabelStyle}>产品更新与新功能上线提醒</div>
          </div>
          <button style={switchStyle(newFeature)} onClick={() => { setNewFeature(!newFeature); showToast(newFeature ? '已关闭' : '已开启'); }} aria-label="新功能通知">
            <span style={switchDot(newFeature)} />
          </button>
        </div>
      </div>
    );
  }

  function renderSecurity() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <p style={sectionTitle}>安全</p>
          <p style={sectionDesc}>管理你的登录与安全设置</p>

          <div style={{ ...rowStyle, ...rowBorder }}>
            <div>
              <div style={labelStyle}>登录邮箱</div>
              <div style={sublabelStyle}>用于接收验证码</div>
            </div>
            <span style={valueStyle}>{userId || '未设置'}</span>
          </div>

          <div style={{ ...rowStyle, ...rowBorder }}>
            <div>
              <div style={labelStyle}>验证方式</div>
              <div style={sublabelStyle}>当前使用邮箱验证码登录</div>
            </div>
            <span style={valueStyle}>邮箱验证码</span>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>登出所有设备</div>
              <div style={sublabelStyle}>清除所有登录会话</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ height: 30, padding: '0 12px', borderRadius: 9999, fontSize: 12, fontWeight: 500, border: '1px solid rgba(185,28,28,0.18)', background: '#1A1A17', color: '#B91C1C', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'background .2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1A1A17'; }}
              aria-label="登出所有设备"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderIntegrations() {
    return (
      <div style={cardStyle}>
        <p style={sectionTitle}>连接与集成</p>
        <p style={sectionDesc}>管理第三方服务连接</p>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>已连接服务</div>
            <div style={sublabelStyle}>当前已接入的外部服务</div>
          </div>
          <span style={placeholderTag}>当前未启用</span>
        </div>

        <div style={{ ...rowStyle, ...rowBorder }}>
          <div>
            <div style={labelStyle}>第三方能力状态</div>
            <div style={sublabelStyle}>图片、视频、搜索等能力</div>
          </div>
          <span style={placeholderTag}>配置后可用</span>
        </div>

        <div style={rowStyle}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>更多集成</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, lineHeight: 1.5 }}>
              Zapier、Slack、飞书等更多集成即将开放，敬请期待。
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sectionRenderers: Record<Section, () => React.ReactNode> = {
    profile: renderProfile,
    preferences: renderPreferences,
    notifications: renderNotifications,
    security: renderSecurity,
    integrations: renderIntegrations,
  };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#121210' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* Top area */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: '#F0EDE8', lineHeight: 1.2, margin: '0 0 8px' }}>设置</h1>
            <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>管理你的账号、偏好与产品设置</p>
          </div>

          {/* Two-column layout */}
          <div style={{ display: 'flex', gap: 24 }}>
            {/* Left nav */}
            <nav style={{ width: 220, flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 40 }}>
                {NAV_ITEMS.map(item => {
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSection(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        height: 40, padding: '0 12px', borderRadius: 12,
                        fontSize: 14, border: 'none',
                        background: active ? 'rgba(255,107,44,0.06)' : 'transparent',
                        color: active ? '#171717' : '#6B7280',
                        fontWeight: active ? 550 : 500,
                        cursor: 'pointer',
                        borderLeft: active ? '2px solid #FF6B2C' : '2px solid transparent',
                        transition: 'all .2s',
                        width: '100%', textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#1A1A17'; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Right content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {sectionRenderers[section]()}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-flow-in" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, padding: '10px 20px', borderRadius: 9999,
          background: 'rgba(34,197,94,0.92)', color: '#fff', fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
