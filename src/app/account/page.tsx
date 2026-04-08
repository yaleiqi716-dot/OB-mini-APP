'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/workspace/AppHeader';

interface UserStatus {
  id: string;
  email?: string;
  name?: string;
  credits: number;
  signupBonusCredits: number;
  dailyTrialCredits: number;
  subscriptionCredits: number;
  generalCredits: number;
  rewardCredits: number;
  plan: string;
  expireAt: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  pendingPlan: string | null;
  currentPeriodEnd: string | null;
  limits: {
    maxConcurrent: number;
    allowedTypes: string[];
    dailyTrialCredits: number;
    monthlySubscriptionCredits: number;
  };
}

interface OrderRecord {
  id: string;
  productType: string;
  productCode: string;
  amount: number;
  credits: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

// Plan display config aligned with billing-config.ts v1
const PLAN_DISPLAY: Record<string, { label: string; price: string; benefits: string[] }> = {
  free: {
    label: 'Free',
    price: '免费',
    benefits: [
      '每日体验赠额 120/日',
      '新人赠送 500（一次性）',
      '并发任务 1',
      '定时任务 2',
    ],
  },
  basic: {
    label: 'Basic',
    price: '¥39/月',
    benefits: [
      '订阅积分 2,000/月',
      '每日体验赠额 60/日',
      '并发任务 3',
      '定时任务 5',
    ],
  },
  pro: {
    label: 'Pro',
    price: '¥89/月',
    benefits: [
      '订阅积分 5,500/月',
      '每日体验赠额 120/日',
      '并发任务 10',
      '定时任务 15',
    ],
  },
  team: {
    label: 'Team',
    price: '¥199/人/月',
    benefits: [
      '订阅积分 6,000/人/月',
      '每日体验赠额 120/日',
      '并发任务 10',
      '定时任务 15',
      '每位成员独立积分',
      '老板可发奖励积分',
    ],
  },
};

const PRODUCT_NAMES: Record<string, string> = {
  basic_monthly: 'Basic 订阅（月付）',
  pro_monthly: 'Pro 订阅（月付）',
  team_monthly: 'Team 订阅（月付）',
  credits_1500: '通用积分包 1,500',
  credits_5500: '通用积分包 5,500',
  credits_20000: '通用积分包 20,000',
};

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  paid: { text: '已完成', color: 'var(--ob-success)' },
  pending: { text: '待支付', color: '#D4A017' },
  failed: { text: '失败', color: '#E4483D' },
  cancelled: { text: '已取消', color: 'var(--ob-text-muted)' },
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserStatus | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [subActing, setSubActing] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    const m = document.cookie.match(/ob-user-id=([^;]+)/);
    if (!m || !m[1]) { router.replace('/login'); return; }
    Promise.all([
      fetch('/api/user').then(r => r.json()),
      fetch('/api/billing/orders').then(r => r.json()).catch(() => []),
    ]).then(([u, o]) => {
      if (u && u.credits !== undefined) setUser(u);
      if (Array.isArray(o)) setOrders(o);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    document.cookie = 'ob-user-id=; path=/; max-age=0';
    document.cookie = 'ob-session=; path=/; max-age=0';
    router.replace('/login');
  }

  function refreshUser() {
    fetch('/api/user').then(r => r.json()).then(u => {
      if (u && u.credits !== undefined) setUser(u);
    }).catch(() => {});
  }

  async function subAction(action: string, targetPlan?: string) {
    if (subActing) return;
    setSubActing(true);
    try {
      const res = await fetch('/api/billing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '操作失败'); return; }
      showToast(data.message);
      refreshUser();
      setShowDowngrade(false);
    } catch { showToast('网络错误'); }
    finally { setSubActing(false); }
  }

  // Derive display values
  const userId = user?.email || user?.id || '';
  const userName = user?.name || userId.split('@')[0] || 'User';
  const plan = user?.plan || 'free';
  const planInfo = PLAN_DISPLAY[plan] || PLAN_DISPLAY.free;

  // Legacy credits handling
  const legacyCredits = user ? (user.credits - (user.signupBonusCredits + user.dailyTrialCredits + user.subscriptionCredits + user.generalCredits + user.rewardCredits)) : 0;
  const hasLegacy = legacyCredits > 0;

  const isExpiringSoon = user?.expireAt
    ? new Date(user.expireAt).getTime() - Date.now() < 7 * 86400000
    : false;
  const statusLabel = !user ? '加载中' : isExpiringSoon ? '即将到期' : '正常';
  const statusBg = isExpiringSoon ? 'rgba(228,72,61,0.10)' : 'rgba(201,184,158,0.10)';
  const statusColor = isExpiringSoon ? '#E4483D' : 'var(--ob-success)';

  // ── Shared styles ──
  const cardStyle: React.CSSProperties = {
    background: 'var(--ob-surface)', border: '1px solid rgba(245,245,240,0.08)', borderRadius: 16, padding: 20,
  };
  const actionBtnStyle: React.CSSProperties = {
    height: 30, padding: '0 12px', borderRadius: 9999,
    fontSize: 12, fontWeight: 500,
    border: '1px solid rgba(245,245,240,0.08)', background: 'var(--ob-surface)',
    color: 'var(--ob-text-muted)', cursor: 'pointer', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center',
    transition: 'border-color .2s, background .2s, color .2s',
  };
  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,90,31,0.3)';
    e.currentTarget.style.background = 'rgba(255,90,31,0.06)';
    e.currentTarget.style.color = '#FF5A1F';
  };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = 'var(--ob-border)';
    e.currentTarget.style.background = 'var(--ob-surface)';
    e.currentTarget.style.color = 'var(--ob-text-muted)';
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 56, padding: '12px 0',
  };
  const rowBorder: React.CSSProperties = { borderBottom: '1px solid rgba(245,245,240,0.08)' };
  const placeholderTag: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 22, fontSize: 11, fontWeight: 500, color: 'var(--ob-text-muted)',
    background: 'var(--ob-bg)', borderRadius: 9999, padding: '0 10px',
    border: '1px solid rgba(245,245,240,0.08)',
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 17, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 16px',
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
        <AppHeader />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid #FF5A1F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--ob-bg)' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* ── Top area ── */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ob-text-muted)', margin: '0 0 8px' }}>
              <span style={{ color: 'var(--ob-orange)' }}>●</span> Account
            </p>
            <h1 style={{ fontFamily: 'var(--ob-font-display)', fontSize: 44, fontWeight: 800, color: 'var(--ob-text)', lineHeight: 1, letterSpacing: '-0.025em', margin: '0 0 12px' }}>账户</h1>
            <p style={{ fontFamily: 'var(--ob-font-body)', fontSize: 14, color: 'var(--ob-text-muted)', margin: 0, maxWidth: 520 }}>查看你的账号信息、套餐与使用权益</p>
          </div>

          {/* ── Account overview card ── */}
          <div style={{ ...cardStyle, minHeight: 140, marginBottom: 20, display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(255,90,31,0.12)', color: '#FF5A1F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 600, flexShrink: 0,
              }}>
                {userName.slice(0, 1).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ob-text)' }}>{userName}</span>
                  {/* Plan badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    height: 24, padding: '0 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500,
                    background: 'rgba(255,90,31,0.10)', color: 'var(--ob-orange)',
                  }}>
                    {planInfo.label}
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
                <span style={{ fontSize: 13, color: 'var(--ob-text-muted)' }}>{userId}</span>
                {user?.expireAt && plan !== 'free' && (
                  <span style={{ fontSize: 12, color: 'var(--ob-text-muted)', marginLeft: 12 }}>
                    到期 {new Date(user.expireAt).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>

              {/* Action */}
              <a href="/settings" style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                管理设置
              </a>
            </div>
          </div>

          {/* ── Total credits card ── */}
          <div style={{ ...cardStyle, marginBottom: 20, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--ob-text-muted)', margin: '0 0 6px' }}>总可用积分</p>
                <p style={{ fontSize: 36, fontWeight: 700, color: '#FF5A1F', margin: 0, lineHeight: 1 }}>
                  {user?.credits ?? 0}
                </p>
              </div>
              <a href="/billing" style={{
                ...actionBtnStyle,
                border: '1px solid #FF5A1F', color: '#FF5A1F',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,90,31,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--ob-surface)'; }}
              >
                充值
              </a>
            </div>

            {/* ── Credit bucket breakdown ── */}
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ob-text)', margin: '0 0 12px' }}>积分明细</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {([
                { label: '每日体验赠额', value: user?.dailyTrialCredits ?? 0, note: '每日刷新，不结转' },
                { label: '新人赠送', value: user?.signupBonusCredits ?? 0, note: '一次性，用完为止' },
                { label: '订阅积分', value: user?.subscriptionCredits ?? 0, note: '按月发放，不结转' },
                { label: '通用积分', value: user?.generalCredits ?? 0, note: '购买到账，持续可用' },
                { label: '奖励积分', value: user?.rewardCredits ?? 0, note: '管理员发放' },
                ...(hasLegacy ? [{ label: '历史兼容积分', value: legacyCredits, note: '旧版遗留，优先级最低' }] : []),
              ] as const).map((bucket, i) => (
                <div key={i} style={{
                  background: 'var(--ob-bg)', borderRadius: 12, padding: '12px 14px',
                  border: '1px solid rgba(255,255,255,0.03)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--ob-text-muted)', margin: '0 0 4px' }}>{bucket.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: 'var(--ob-text)', margin: '0 0 2px', lineHeight: 1 }}>
                    {bucket.value}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--ob-text-dim)', margin: 0 }}>{bucket.note}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--ob-text-dim)', margin: '12px 0 0' }}>
              消耗顺序：每日体验赠额 → 新人赠送 → 订阅积分 → 通用积分 → 奖励积分{hasLegacy ? ' → 历史兼容积分' : ''}
            </p>
          </div>

          {/* ── Current plan benefits ── */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={sectionTitle}>当前套餐权益</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#FF5A1F' }}>{planInfo.label}</span>
                <span style={{ fontSize: 13, color: 'var(--ob-text-muted)' }}>{planInfo.price}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px' }}>
              {planInfo.benefits.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C9B89E', flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#8A8A90' }}>{b}</span>
                </div>
              ))}
            </div>

            {/* Subscription lifecycle status */}
            {plan !== 'free' && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--ob-bg)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
                {user?.currentPeriodEnd && (
                  <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', margin: '0 0 4px' }}>
                    当前周期到期：{new Date(user.currentPeriodEnd).toLocaleDateString('zh-CN')}
                  </p>
                )}
                {!user?.currentPeriodEnd && user?.expireAt && (
                  <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', margin: '0 0 4px' }}>
                    订阅到期：{new Date(user.expireAt).toLocaleDateString('zh-CN')}
                  </p>
                )}

                {/* Cancel status */}
                {user?.cancelAtPeriodEnd && (
                  <p style={{ fontSize: 13, color: '#D4A017', margin: '4px 0', fontWeight: 500 }}>
                    已设置到期取消 — 到期后将降为 Free
                  </p>
                )}

                {/* Pending downgrade status */}
                {user?.pendingPlan && !user?.cancelAtPeriodEnd && (
                  <p style={{ fontSize: 13, color: '#D4A017', margin: '4px 0', fontWeight: 500 }}>
                    已设置到期降级为 {(PLAN_DISPLAY[user.pendingPlan] || { label: user.pendingPlan }).label}
                  </p>
                )}

                {/* Info note */}
                {(user?.cancelAtPeriodEnd || user?.pendingPlan) && (
                  <p style={{ fontSize: 11, color: 'var(--ob-text-dim)', margin: '4px 0 0' }}>
                    当前周期内仍可正常使用全部权益，通用积分不受影响
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/billing" style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                {plan === 'free' ? '升级套餐' : '续费 / 升级'}
              </a>

              {plan !== 'free' && !user?.cancelAtPeriodEnd && !user?.pendingPlan && (
                <>
                  <button
                    onClick={() => { if (confirm('确定要在到期后取消订阅吗？当前周期内权益不受影响。')) subAction('cancel'); }}
                    disabled={subActing}
                    style={{ ...actionBtnStyle, color: '#E4483D', borderColor: 'rgba(185,28,28,0.18)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(228,72,61,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--ob-surface)'; }}
                  >
                    取消订阅
                  </button>
                  {/* Downgrade: only show if plan > basic */}
                  {(['pro', 'team'].includes(plan)) && (
                    <button
                      onClick={() => setShowDowngrade(!showDowngrade)}
                      style={actionBtnStyle}
                      onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                    >
                      降级套餐
                    </button>
                  )}
                </>
              )}

              {/* Undo cancel */}
              {user?.cancelAtPeriodEnd && (
                <button
                  onClick={() => subAction('undo_cancel')}
                  disabled={subActing}
                  style={actionBtnStyle}
                  onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                >
                  撤销取消
                </button>
              )}

              {/* Undo downgrade */}
              {user?.pendingPlan && !user?.cancelAtPeriodEnd && (
                <button
                  onClick={() => subAction('undo_downgrade')}
                  disabled={subActing}
                  style={actionBtnStyle}
                  onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                >
                  撤销降级
                </button>
              )}
            </div>

            {/* Downgrade target picker */}
            {showDowngrade && plan !== 'free' && (
              <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--ob-bg)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
                <p style={{ fontSize: 12, color: 'var(--ob-text-muted)', margin: '0 0 8px' }}>选择到期后的目标套餐：</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['free', 'basic', 'pro'] as const)
                    .filter(p => {
                      const PLAN_ORDER = ['free', 'basic', 'pro', 'team'];
                      return PLAN_ORDER.indexOf(p) < PLAN_ORDER.indexOf(plan);
                    })
                    .map(target => (
                      <button
                        key={target}
                        onClick={() => {
                          if (target === 'free') {
                            if (confirm('确定要在到期后取消订阅（降为 Free）吗？')) subAction('cancel');
                          } else {
                            if (confirm(`确定要在到期后降级为 ${PLAN_DISPLAY[target].label} 吗？当前周期内权益不受影响。`)) subAction('downgrade', target);
                          }
                        }}
                        disabled={subActing}
                        style={{ ...actionBtnStyle, fontSize: 13 }}
                        onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                      >
                        {PLAN_DISPLAY[target].label} {target === 'free' ? '（取消订阅）' : `(${PLAN_DISPLAY[target].price})`}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Recent orders ── */}
          <div style={{ ...cardStyle, marginBottom: 20 }}>
            <p style={sectionTitle}>最近订单</p>
            {orders.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', margin: 0 }}>暂无购买记录</p>
            ) : (
              <div>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 80px 80px', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(245,245,240,0.10)' }}>
                  <span style={{ fontSize: 11, color: 'var(--ob-text-dim)', fontWeight: 500 }}>时间</span>
                  <span style={{ fontSize: 11, color: 'var(--ob-text-dim)', fontWeight: 500 }}>商品</span>
                  <span style={{ fontSize: 11, color: 'var(--ob-text-dim)', fontWeight: 500 }}>类型</span>
                  <span style={{ fontSize: 11, color: 'var(--ob-text-dim)', fontWeight: 500, textAlign: 'right' }}>金额</span>
                  <span style={{ fontSize: 11, color: 'var(--ob-text-dim)', fontWeight: 500, textAlign: 'right' }}>状态</span>
                </div>
                {orders.slice(0, 10).map(order => {
                  const statusInfo = STATUS_LABELS[order.status] || { text: order.status, color: 'var(--ob-text-muted)' };
                  return (
                    <div key={order.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 80px 80px', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--ob-text-muted)' }}>
                        {new Date(order.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}{' '}
                        {new Date(order.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ob-text)' }}>
                        {PRODUCT_NAMES[order.productCode] || order.productCode}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ob-text-muted)' }}>
                        {order.productType === 'subscription' ? '订阅' : '通用积分包'}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ob-text)', textAlign: 'right' }}>
                        ¥{(order.amount / 100).toFixed(order.amount % 100 === 0 ? 0 : 2)}
                      </span>
                      <span style={{ fontSize: 12, color: statusInfo.color, textAlign: 'right', fontWeight: 500 }}>
                        {statusInfo.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Account actions ── */}
          <div style={cardStyle}>
            <p style={sectionTitle}>账号操作</p>

            <div style={{ ...rowStyle, ...rowBorder }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ob-text)' }}>设置</div>
                <div style={{ fontSize: 12, color: 'var(--ob-text-muted)', marginTop: 2 }}>偏好、通知、安全与集成</div>
              </div>
              <a href="/settings" style={actionBtnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>前往设置</a>
            </div>

            <div style={{ ...rowStyle, ...rowBorder }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ob-text)' }}>导出数据</div>
                <div style={{ fontSize: 12, color: 'var(--ob-text-muted)', marginTop: 2 }}>导出你的任务记录与结果</div>
              </div>
              <span style={placeholderTag}>即将开放</span>
            </div>

            <div style={{ ...rowStyle, ...rowBorder }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ob-text)' }}>订阅与充值</div>
                <div style={{ fontSize: 12, color: 'var(--ob-text-muted)', marginTop: 2 }}>管理套餐与额度</div>
              </div>
              <a href="/billing" style={actionBtnStyle}
                onMouseEnter={hoverIn} onMouseLeave={hoverOut}>前往充值</a>
            </div>

            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ob-text)' }}>退出登录</div>
                <div style={{ fontSize: 12, color: 'var(--ob-text-muted)', marginTop: 2 }}>退出当前账号</div>
              </div>
              <button
                onClick={handleLogout}
                aria-label="退出登录"
                style={{
                  height: 30, padding: '0 12px', borderRadius: 9999,
                  fontSize: 12, fontWeight: 500,
                  border: '1px solid rgba(185,28,28,0.18)', background: 'var(--ob-surface)',
                  color: '#E4483D', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(228,72,61,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--ob-surface)')}
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
          background: 'rgba(201,184,158,0.92)', color: '#fff', fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
