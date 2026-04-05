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
  credits: number;
  plan?: string;
  durationDays?: number;
}

interface UserStatus {
  credits: number;
  plan: string;
  expireAt: string | null;
}

type PayState = 'pending' | 'polling' | 'success' | 'failed';

function QRModal({
  qrUrl, amountLabel, orderId, onDone, onCancel,
}: {
  qrUrl: string; amountLabel: string; orderId: string;
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
            <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.28)' }}>额度已到账，正在刷新...</p>
          </div>
        ) : payState === 'failed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#E0D8D0' }}>支付未完成</p>
            <p style={{ fontSize: 14, color: 'rgba(224,216,208,0.28)' }}>请重试或使用其他支付方式</p>
            <button onClick={onCancel} style={{ height: 36, padding: '0 20px', borderRadius: 9999, fontSize: 14, border: '1px solid rgba(255,255,255,0.04)', background: '#252321', color: 'rgba(224,216,208,0.28)', cursor: 'pointer' }}>关闭</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#E0D8D0', marginBottom: 4 }}>微信扫码支付</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#FF3D00' }}>{amountLabel}</p>
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
  const [qrModal, setQrModal] = useState<{qrUrl:string;orderId:string;amountLabel:string}|null>(null);
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
    setQrModal(null); setBuying(null);
    if (success) { showToast('支付成功！额度已到账', true); fetchUser(); }
    else showToast('支付未完成，请重试', false);
  }

  async function handleBuy(code: string) {
    if (buying) return;
    setBuying(code);
    try {
      const res = await fetch('/api/billing/create-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productCode: code }) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || '创建订单失败', false); setBuying(null); return; }
      const product = products.find(p => p.code === code);
      setQrModal({ qrUrl: data.codeUrl, orderId: data.orderId, amountLabel: product?.amountLabel || '¥19' });
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
        <div className="ob-fuel-atmosphere" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 360, pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '48px 32px 60px', position: 'relative', zIndex: 1 }}>

          {/* Hero */}
          <div style={{ marginBottom: 32 }}>
            <h1 className="ob-hero-title" style={{ fontSize: 32, textAlign: 'left' }}>
              执行<span className="ob-hero-accent">燃料</span>补给
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(224,216,208,0.28)', margin: 0 }}>订阅解锁长期能力，额度包补给高强度执行</p>
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
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#C2410C', background: 'rgba(255,61,0,0.10)', padding: '2px 10px', borderRadius: 9999 }}>当前套餐</span>
                    </div>
                    {user.expireAt && (
                      <span style={{ fontSize: 12, color: 'rgba(224,216,208,0.55)' }}>到期 {new Date(user.expireAt).toLocaleDateString('zh-CN')}</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 36, fontWeight: 700, color: isLow ? '#B91C1C' : '#FF3D00', lineHeight: 1 }}>{user.credits}</span>
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
                {subs.map((p, idx) => {
                  const isRecommended = idx === 1; // Pro = middle tier
                  return (
                  <div key={p.code} className={isRecommended ? 'ob-tier-recommended' : ''} style={{
                    background: '#252321', border: isRecommended ? undefined : '1px solid rgba(255,255,255,0.04)', borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column', position: 'relative',
                    transition: 'border-color .2s, box-shadow .2s',
                  }}
                    onMouseEnter={e => { if (!isRecommended) e.currentTarget.style.borderColor = 'rgba(255,61,0,0.3)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { if (!isRecommended) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {isRecommended && <span className="ob-tier-badge">推荐</span>}
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#E0D8D0', margin: '0 0 8px' }}>{p.label}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#FF3D00', margin: '0 0 4px' }}>
                      {p.amountLabel}<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(224,216,208,0.55)' }}>/月</span>
                    </p>
                    <p style={{ fontSize: 13, color: 'rgba(224,216,208,0.28)', margin: '0 0 16px' }}>{p.credits} 额度 · {p.durationDays} 天</p>
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      style={{
                        height: 40, borderRadius: 12, fontSize: 14, fontWeight: 600,
                        border: 'none', background: '#FF3D00', color: '#fff',
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
              <p style={{ fontSize: 17, fontWeight: 600, color: '#E0D8D0', margin: '0 0 14px' }}>额度补给包</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {creds.map(p => (
                  <div key={p.code} style={{
                    background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column',
                    transition: 'border-color .2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,61,0,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
                  >
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#E0D8D0', margin: '0 0 8px' }}>{p.label}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#E0D8D0', margin: '0 0 4px' }}>{p.amountLabel}</p>
                    <p style={{ fontSize: 13, color: 'rgba(224,216,208,0.28)', margin: '0 0 16px' }}>+{p.credits} 额度</p>
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      style={{
                        height: 40, borderRadius: 12, fontSize: 14, fontWeight: 600,
                        border: '2px solid #FF3D00', background: 'transparent', color: '#FF3D00',
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
        </div>
      </div>

      {/* QR Modal */}
      {qrModal && (
        <QRModal qrUrl={qrModal.qrUrl} amountLabel={qrModal.amountLabel} orderId={qrModal.orderId}
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
