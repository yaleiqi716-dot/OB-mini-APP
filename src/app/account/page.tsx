'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAIN_NAV } from '@/lib/nav';

interface UserInfo {
  id: string;
  email?: string;
  name?: string;
  credits: number;
  plan: string;
  expireAt: string | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); return; }
    fetch('/api/user')
      .then(r => r.json())
      .then(d => {
        if (d && d.credits !== undefined) setUser(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    document.cookie = 'ob-user-id=; path=/; max-age=0';
    document.cookie = 'ob-session=; path=/; max-age=0';
    router.replace('/login');
  }

  // Derive display values
  const userId = user?.email || user?.id || '';
  const userName = user?.name || userId.split('@')[0] || 'User';
  const planLabel = user?.plan || 'Free';
  const credits = user?.credits ?? 0;

  const isExpiringSoon = user?.expireAt
    ? new Date(user.expireAt).getTime() - Date.now() < 7 * 86400000
    : false;
  const statusLabel = !user ? '加载中' : isExpiringSoon ? '即将到期' : '正常';
  const statusBg = isExpiringSoon ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)';
  const statusColor = isExpiringSoon ? '#B91C1C' : '#047857';

  // ── Shared styles ──
  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16, padding: 20,
  };
  const actionBtnStyle: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 9999,
    fontSize: 12, fontWeight: 500,
    border: '1px solid #E7E5E1', background: '#FFFFFF',
    color: '#6B7280', cursor: 'pointer', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center',
    transition: 'border-color .2s, background .2s, color .2s',
  };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,122,26,0.3)';
    e.currentTarget.style.background = 'rgba(255,122,26,0.06)';
    e.currentTarget.style.color = '#F97316';
  };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = '#E7E5E1';
    e.currentTarget.style.background = '#FFFFFF';
    e.currentTarget.style.color = '#6B7280';
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, padding: '12px 0',
  };
  const rowBorder: React.CSSProperties = { borderBottom: '1px solid #F0EDE8' };
  const placeholderTag: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 22, fontSize: 11, fontWeight: 500, color: '#9CA3AF',
    background: '#F7F7F4', borderRadius: 9999, padding: '0 10px',
    border: '1px solid #E7E5E1',
  };

  const headerBar = (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 52, padding: '0 32px',
      borderBottom: '1px solid #E7E5E1',
      background: '#F7F7F4', flexShrink: 0,
    }}>
      <a href="/agent" style={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
        <span style={{ color: '#F97316', fontWeight: 700, fontSize: 15 }}>ORANGE</span>
        <span style={{ color: '#171717', fontWeight: 700, fontSize: 15 }}>BENCH</span>
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {MAIN_NAV.map(n => {
          const active = n.href === '/account';
          return active ? (
            <span key={n.href} style={{ fontSize: 13, fontWeight: 600, color: '#F97316', padding: '4px 10px', borderRadius: 8, background: 'rgba(255,122,26,0.10)' }}>{n.label}</span>
          ) : (
            <a key={n.href} href={n.href} style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'none', padding: '4px 10px', borderRadius: 8, transition: 'color .2s' }}>{n.label}</a>
          );
        })}
      </nav>
    </header>
  );

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
        {headerBar}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #F97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      {headerBar}

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* ── Top area ── */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: '#171717', lineHeight: 1.2, margin: '0 0 8px' }}>账户</h1>
            <p style={{ fontSize: 14, color: '#7A7A7A', margin: 0, maxWidth: 520 }}>查看你的账号信息、套餐与使用权益</p>
          </div>

          {/* ── Account overview card ── */}
          <div style={{ ...cardStyle, minHeight: 140, marginBottom: 20, display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,122,26,0.12)', color: '#F97316',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 600, flexShrink: 0,
              }}>
                {userName.slice(0, 1).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: '#171717' }}>{userName}</span>
                  {/* Plan badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    height: 24, padding: '0 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500,
                    background: 'rgba(255,122,26,0.10)', color: '#C2410C',
                  }}>
                    {planLabel}
                  </span>
                  {/* Status badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    height: 24, padding: '0 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500,
                    background: statusBg, color: statusColor,
                  }}>
                    {statusLabel}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: '#6B7280' }}>{userId}</span>
              </div>

              {/* Action */}
              <a href="/settings" style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                管理设置
              </a>
            </div>
          </div>

          {/* ── 3 benefit cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            {/* Credits */}
            <div style={{ ...cardStyle, height: 104, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px' }}>月度额度</p>
              <p style={{ fontSize: 24, fontWeight: 650, color: '#171717', margin: '0 0 4px', lineHeight: 1 }}>{credits}</p>
              <p style={{ fontSize: 12, color: '#A3A3A3', margin: 0 }}>剩余可用 credits</p>
            </div>

            {/* Permissions */}
            <div style={{ ...cardStyle, height: 104, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px' }}>当前权限</p>
              <p style={{ fontSize: 24, fontWeight: 650, color: '#171717', margin: '0 0 4px', lineHeight: 1 }}>基础</p>
              <p style={{ fontSize: 12, color: '#A3A3A3', margin: 0 }}>文本生成、邮件、PPT</p>
            </div>

            {/* Capabilities */}
            <div style={{ ...cardStyle, height: 104, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 6px' }}>已启用能力</p>
              <p style={{ fontSize: 24, fontWeight: 650, color: '#171717', margin: '0 0 4px', lineHeight: 1 }}>3</p>
              <p style={{ fontSize: 12, color: '#A3A3A3', margin: 0 }}>文本 / 搜索 / 结构化</p>
            </div>
          </div>

          {/* ── Plan benefits ── */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#171717', margin: '0 0 16px' }}>当前套餐权益</p>
            <div style={{ display: 'flex', gap: 40 }}>
              {/* Enabled */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#171717', margin: '0 0 10px' }}>已启用</p>
                {[
                  'AI 文本生成与优化',
                  '邮件自动撰写',
                  'PPT 结构生成',
                  '方案与报告撰写',
                  '多轮对话上下文',
                  'Brave 搜索集成',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#404040', lineHeight: 1.8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
              {/* Coming soon */}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#171717', margin: '0 0 10px' }}>即将开放</p>
                {[
                  '图片生成 (Leonardo)',
                  '视频生成 (MiniMax)',
                  '数字人视频 (Akool)',
                  '浏览器自动化 (Manus)',
                  'Zapier 自动化集成',
                  '团队协作空间',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#9CA3AF', lineHeight: 1.8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D5D3CE', flexShrink: 0 }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Account actions ── */}
          <div style={cardStyle}>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#171717', margin: '0 0 12px' }}>账号操作</p>

            <div style={{ ...rowStyle, ...rowBorder }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#171717' }}>设置</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>偏好、通知、安全与集成</div>
              </div>
              <a href="/settings" style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>前往设置</a>
            </div>

            <div style={{ ...rowStyle, ...rowBorder }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#171717' }}>导出数据</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>导出你的任务记录与结果</div>
              </div>
              <span style={placeholderTag}>即将开放</span>
            </div>

            <div style={{ ...rowStyle, ...rowBorder }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#171717' }}>账单与充值</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>管理订阅与额度</div>
              </div>
              <span style={placeholderTag}>即将开放</span>
            </div>

            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#171717' }}>退出登录</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>退出当前账号</div>
              </div>
              <button
                onClick={handleLogout}
                aria-label="退出登录"
                style={{
                  height: 30, padding: '0 12px', borderRadius: 9999,
                  fontSize: 12, fontWeight: 500,
                  border: '1px solid rgba(185,28,28,0.18)', background: '#FFFFFF',
                  color: '#B91C1C', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
              >
                退出登录
              </button>
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
