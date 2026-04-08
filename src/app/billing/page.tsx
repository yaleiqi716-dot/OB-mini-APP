'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { AppHeader } from '@/components/workspace/AppHeader';

interface Product {
  code: string;
  type: 'subscription' | 'credits';
  label: string;
  amount: number;
  amountLabel: string;
  // Subscription fields
  plan?: string;
  credits?: number;
  dailyTrialCredits?: number;
  durationDays?: number;
  concurrency?: number;
  scheduledTasks?: number;
  features?: string[];
  description?: string;
  recommended?: boolean;
  teamPerSeat?: boolean;
  // Credits fields
  baseCredits?: number;
  bonusCredits?: number;
  totalCredits?: number;
  displayLabel?: string;
}

interface UserStatus {
  credits: number;
  plan: string;
  expireAt: string | null;
}

type PayState = 'pending' | 'polling' | 'success' | 'failed';

function QRModal({
  qrUrl, amountLabel, orderId, product, onDone, onCancel,
}: {
  qrUrl: string; amountLabel: string; orderId: string; product: Product | null;
  onDone: (success: boolean) => void; onCancel: () => void;
}) {
  const [payState, setPayState] = useState<PayState>('pending');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);

  useEffect(() => {
    setPayState('polling');
    const startPoll = setTimeout(() => {
      pollRef.current = setInterval(async () => {
        elapsed.current += 1;
        try {
          const res = await fetch(`/api/billing/order/${orderId}`);
          const data = await res.json();
          if (data.status === 'paid') {
            clearInterval(pollRef.current!);
            setPayState('success');
            setTimeout(() => onDone(true), 900);
            return;
          }
          if (data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(pollRef.current!);
            setPayState('failed');
            setTimeout(() => onDone(false), 1200);
            return;
          }
        } catch { /* keep polling */ }
        if (elapsed.current >= 30) {
          clearInterval(pollRef.current!);
          setPayState('failed');
          setTimeout(() => onDone(false), 1200);
        }
      }, 1000);
    }, 500);
    return () => { clearTimeout(startPoll); if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#252321', borderRadius: 20, padding: 32, width: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} className="animate-flow-in">
        {payState === 'success' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#E0D8D0' }}>支付成功</p>
            {product?.type === 'subscription' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: '#D1D5DB', margin: '0 0 4px' }}>
                  已开通 <span style={{ color: '#FF5A1F', fontWeight: 600 }}>{product.label}</span> 订阅
                </p>
                <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.45)', margin: 0 }}>
                  +{product.credits} 订阅积分已到账 · 每日体验赠额 {product.dailyTrialCredits}/日
                </p>
              </div>
            ) : product?.type === 'credits' ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: '#D1D5DB', margin: '0 0 4px' }}>
                  +<span style={{ color: '#FF5A1F', fontWeight: 600 }}>{product.totalCredits}</span> 通用积分已到账
                </p>
                {(product.bonusCredits ?? 0) > 0 && (
                  <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.45)', margin: 0 }}>
                    含赠送 {product.bonusCredits}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.45)' }}>积分已到账，正在刷新...</p>
            )}
          </div>
        ) : payState === 'failed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#E0D8D0' }}>支付未完成</p>
            <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.45)', margin: 0, textAlign: 'center' }}>
              {product?.type === 'subscription'
                ? `${product.label} 订阅未完成支付`
                : product?.type === 'credits'
                ? `${product.displayLabel || '通用积分包'}未完成支付`
                : '未完成支付'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.28)', margin: 0 }}>请重试或使用其他支付方式</p>
            <button onClick={onCancel} style={{ height: 36, padding: '0 20px', borderRadius: 9999, fontSize: 14, border: '1px solid rgba(255,255,255,0.04)', background: '#252321', color: 'rgba(224,216,208,0.45)', cursor: 'pointer' }}>关闭</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#E0D8D0', marginBottom: 4 }}>微信扫码支付</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#FF5A1F' }}>{amountLabel}</p>
            </div>
            <div style={{ padding: 8, borderRadius: 16, border: '2px solid rgba(255,255,255,0.04)', background: '#252321' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`} alt="支付二维码" width={180} height={180} style={{ borderRadius: 8 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'rgba(224,216,208,0.28)' }}>
              <Spinner size="sm" />
              <span>正在确认支付状态...</span>
            </div>
            <button onClick={onCancel} style={{ fontSize: 13, color: 'rgba(224,216,208,0.55)', background: 'none', border: 'none', cursor: 'pointer' }}>取消支付</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{qrUrl:string;orderId:string;amountLabel:string;product:Product|null}|null>(null);
  const [toast, setToast] = useState<{text:string;ok:boolean}|null>(null);

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) router.replace('/login');
  }, [router]);

  const showToast = (text: string, ok = true) => { setToast({text, ok}); setTimeout(() => setToast(null), 3500); };

  const fetchUser = useCallback(() => {
    fetch('/api/user').then(r=>r.json()).then(d=>{ if(d.credits!==undefined) setUser(d); }).catch(()=>{});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/create-order').then(r=>r.json()),
      fetch('/api/user').then(r=>r.json()),
    ]).then(([prod, usr]) => {
      if (prod.products) setProducts(prod.products);
      if (usr.credits !== undefined) setUser(usr);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function handlePayDone(success: boolean) {
    const product = qrModal?.product;
    setQrModal(null); setBuying(null);
    if (success) {
      const msg = product?.type === 'subscription'
        ? `${product.label} 订阅已开通，+${product.credits} 订阅积分到账`
        : product?.type === 'credits'
        ? `+${product.totalCredits} 通用积分已到账`
        : '支付成功！积分已到账';
      showToast(msg, true);
      fetchUser();
    } else {
      showToast('支付未完成，请重试', false);
    }
  }

  async function handleBuy(code: string) {
    if (buying) return;
    setBuying(code);
    try {
      const res = await fetch('/api/billing/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productCode: code }) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '创建订单失败', false); setBuying(null); return; }
      const product = products.find(p => p.code === code) || null;
      setQrModal({ qrUrl: data.codeUrl, orderId: data.orderId, amountLabel: product?.amountLabel || '¥19', product });
    } catch { showToast('网络错误', false); setBuying(null); }
  }

  const subs = products.filter(p => p.type === 'subscription');
  const creds = products.filter(p => p.type === 'credits');
  const planLabel = user?.plan?.toUpperCase() || 'FREE';

  if (loading) return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1E1C1A' }}>
      <AppHeader />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size="md" /></div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#1E1C1A' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} className="custom-scrollbar">
        {/* Fuel station atmosphere */}
        {/* Fuel atmosphere + dot grid — separate layers */}
        <div className="ob-fuel-atmosphere" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />
        <div className="ob-dotgrid ob-dotgrid--billing" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420, zIndex: 0 }} />
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '48px 32px 60px', position: 'relative', zIndex: 1 }}>

          {/* Eyebrow + Hero */}
          <div style={{ marginBottom: 24 }}>
            {/* Eyebrow — mono signal line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ width: 24, height: 2, background: '#FF5A1F', borderRadius: 1 }} />
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#FF5A1F' }}>FUEL STATION</span>
            </div>
            <h1 className="ob-hero-title" style={{ fontSize: 32, textAlign: 'left', marginBottom: 8 }}>
              执行<span className="ob-hero-accent">燃料</span>补给
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(224,216,208,0.45)', margin: 0 }}>订阅解锁长期能力，额度包补给高强度执行</p>
          </div>

          {/* Fuel status card */}
          {user && (() => {
            const maxCredits = planLabel === 'FREE' ? 100 : planLabel === 'BASIC' ? 1000 : planLabel === 'PRO' ? 5000 : 20000;
            const pct = Math.min(100, Math.round((user.credits / maxCredits) * 100));
            const isLow = user.credits < 20;
            return (
              <div style={{ background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 24, marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: '#E0D8D0' }}>{planLabel}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#C2410C', background: 'rgba(255,90,31,0.10)', padding: '2px 10px', borderRadius: 9999 }}>当前套餐</span>
                    </div>
                    {user.expireAt && (
                      <span style={{ fontSize: 12, color: 'rgba(224,216,208,0.55)' }}>到期 {new Date(user.expireAt).toLocaleDateString('zh-CN')}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 36, fontWeight: 700, color: isLow ? '#B91C1C' : '#FF5A1F', lineHeight: 1 }}>{user.credits}</span>
                    <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.55)', margin: '4px 0 0' }}>剩余额度</p>
                  </div>
                </div>
                {/* Fuel gauge */}
                <div className="ob-fuel-gauge">
                  <div className={`ob-fuel-fill ${isLow ? 'ob-fuel-fill--low' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(224,216,208,0.55)', marginTop: 4 }}>
                  <span>{isLow ? '额度不足，建议充值' : `已使用 ${100 - pct}%`}</span>
                  <span>上限 {maxCredits}</span>
                </div>
              </div>
            );
          })()}

          {/* Subscription plans */}
          {subs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#E0D8D0', margin: '0 0 14px' }}>订阅套餐</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {subs.map((p) => {
                  const isRecommended = p.recommended;
                  return (
                  <div key={p.code} className={isRecommended ? 'ob-tier-recommended' : ''} style={{
                    background: '#252321', border: isRecommended ? undefined : '1px solid rgba(255,255,255,0.04)', borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column', position: 'relative',
                    transition: 'border-color .2s, box-shadow .2s',
                  }}
                    onMouseEnter={e => { if (!isRecommended) e.currentTarget.style.borderColor = 'rgba(255,90,31,0.3)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { if (!isRecommended) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {isRecommended && <span className="ob-tier-badge">推荐</span>}
                    <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 600, color: '#E0D8D0', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>{p.label}</p>
                    <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.45)', margin: '0 0 10px' }}>{p.description}{p.teamPerSeat ? ' · 按人/月' : ''}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#FF5A1F', margin: '0 0 4px' }}>
                      {p.amountLabel}<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(224,216,208,0.45)' }}>{p.teamPerSeat ? '/人/月' : '/月'}</span>
                    </p>
                    <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: '#8A8078', margin: '0 0 4px' }}>{p.credits} 订阅积分/月 · {p.dailyTrialCredits} 体验赠额/日</p>
                    <p style={{ fontSize: 11, color: 'rgba(224,216,208,0.35)', margin: '0 0 12px' }}>{p.concurrency} 并发 · {p.scheduledTasks} 定时任务</p>
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      style={{
                        height: 40, borderRadius: 6, fontSize: 14, fontWeight: 600,
                        border: isRecommended ? 'none' : '1px solid #FF5A1F',
                        background: isRecommended ? '#FF5A1F' : 'transparent',
                        color: isRecommended ? '#fff' : '#FF5A1F',
                        cursor: buying ? 'wait' : 'pointer', opacity: buying ? 0.5 : 1,
                        transition: 'background .2s', marginTop: 'auto',
                      }}
                    >
                      {buying === p.code ? '创建订单...' : user?.plan === p.plan ? '续费' : '订阅'}
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Credits packs */}
          {creds.length > 0 && (
            <div>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#E0D8D0', margin: '0 0 6px' }}>通用积分包</p>
              <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.35)', margin: '0 0 14px' }}>用于重任务、超额使用和临时补量</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {creds.map(p => (
                  <div key={p.code} style={{
                    background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column',
                    transition: 'border-color .2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,90,31,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
                  >
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#E0D8D0', margin: '0 0 4px' }}>{p.amountLabel}</p>
                    <p style={{ fontSize: 13, color: 'rgba(224,216,208,0.45)', margin: '0 0 4px' }}>{p.displayLabel || `+${p.totalCredits} 通用积分`}</p>
                    {(p.bonusCredits ?? 0) > 0 && <p style={{ fontSize: 11, color: '#FF5A1F', margin: '0 0 12px' }}>含赠送 {p.bonusCredits}</p>}
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      style={{
                        height: 40, borderRadius: 12, fontSize: 14, fontWeight: 600,
                        border: '2px solid #FF5A1F', background: 'transparent', color: '#FF5A1F',
                        cursor: buying ? 'wait' : 'pointer', opacity: buying ? 0.5 : 1,
                        transition: 'background .2s', marginTop: 'auto',
                      }}
                    >
                      {buying === p.code ? '创建订单...' : '购买'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit rules FAQ */}
          <div style={{ marginTop: 32, padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: '#8A8078', letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 16px' }}>CREDIT RULES</p>
            <p style={{ fontSize: 13, color: 'rgba(224,216,208,0.45)', margin: '0 0 6px' }}>
              消耗顺序：每日体验赠额 → 新人赠送 → 订阅积分 → 通用积分 → 奖励积分
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginTop: 12 }}>
              {[
                { q: '每日体验赠额', a: '每天自动刷新（Free 120/日），当日有效，不结转，不可提现' },
                { q: '新人赠送', a: '注册即送 500，一次性，用完为止' },
                { q: '订阅积分', a: '按月发放，用于正式 Agent 任务和深度执行，不结转（每月重置）' },
                { q: '通用积分', a: '购买到账，不受订阅状态影响，持续有效' },
                { q: '奖励积分', a: '由老板发放，员工可使用；不可转赠、不可折现（当前阶段）' },
                { q: '取消订阅后会怎样', a: '到期后降为 Free，当前周期内权益不变。通用积分不受影响' },
                { q: '支付成功后多久到账', a: '微信支付通常 1~30 秒内到账。超过 5 分钟请联系客服' },
                { q: '任务失败扣积分吗', a: '因平台技术原因失败的任务会返还积分' },
                { q: 'Team 是共享池吗', a: '不是。每位成员拥有独立积分，老板可发奖励积分' },
                { q: '通用积分与订阅积分的区别', a: '订阅积分按月发放不结转；通用积分购买到账持续可用' },
              ].map((item, i) => (
                <div key={i} style={{ padding: '8px 0' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(224,216,208,0.55)', margin: '0 0 2px' }}>{item.q}</p>
                  <p style={{ fontSize: 12, color: 'rgba(224,216,208,0.35)', margin: 0 }}>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {qrModal && (
        <QRModal qrUrl={qrModal.qrUrl} amountLabel={qrModal.amountLabel} orderId={qrModal.orderId} product={qrModal.product}
          onDone={handlePayDone} onCancel={() => { setQrModal(null); setBuying(null); }} />
      )}

      {/* Toast */}
      {toast && (
        <div className="animate-flow-in" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, padding: '10px 20px', borderRadius: 9999,
          background: toast.ok ? 'rgba(34,197,94,0.92)' : 'rgba(239,68,68,0.92)',
          color: '#fff', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
