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
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 32, width: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} className="animate-flow-in">
        {payState === 'success' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#171717' }}>支付成功</p>
            <p style={{ fontSize: 14, color: '#6B7280' }}>额度已到账，正在刷新...</p>
          </div>
        ) : payState === 'failed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#171717' }}>支付未完成</p>
            <p style={{ fontSize: 14, color: '#6B7280' }}>请重试或使用其他支付方式</p>
            <button onClick={onCancel} style={{ height: 36, padding: '0 20px', borderRadius: 9999, fontSize: 14, border: '1px solid #E7E5E1', background: '#FFFFFF', color: '#6B7280', cursor: 'pointer' }}>关闭</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#171717', marginBottom: 4 }}>微信扫码支付</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#F97316' }}>{amountLabel}</p>
            </div>
            <div style={{ padding: 8, borderRadius: 16, border: '2px solid #E7E5E1', background: '#FFFFFF' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`} alt="支付二维码" width={180} height={180} style={{ borderRadius: 8 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#6B7280' }}>
              <Spinner size="sm" />
              <span>正在确认支付状态...</span>
            </div>
            <button onClick={onCancel} style={{ fontSize: 13, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>取消支付</button>
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      <AppHeader />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size="md" /></div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F7F4' }}>
      <AppHeader />

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 32px 60px' }}>

          {/* Title */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: '#171717', margin: '0 0 8px' }}>订阅与充值</h1>
            <p style={{ fontSize: 14, color: '#7A7A7A', margin: 0 }}>管理你的套餐与额度</p>
          </div>

          {/* Current status card */}
          {user && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16, padding: 20, marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 4px' }}>当前套餐</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 650, color: '#171717' }}>{planLabel}</span>
                    {user.expireAt && (
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>到期 {new Date(user.expireAt).toLocaleDateString('zh-CN')}</span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 4px' }}>剩余额度</p>
                <span style={{ fontSize: 28, fontWeight: 650, color: user.credits < 20 ? '#B91C1C' : '#F97316' }}>{user.credits}</span>
              </div>
            </div>
          )}

          {/* Subscription plans */}
          {subs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#171717', margin: '0 0 14px' }}>订阅套餐</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {subs.map(p => (
                  <div key={p.code} style={{
                    background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column',
                    transition: 'border-color .2s, box-shadow .2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,122,26,0.3)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E7E5E1'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#171717', margin: '0 0 8px' }}>{p.label}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#F97316', margin: '0 0 4px' }}>
                      {p.amountLabel}<span style={{ fontSize: 13, fontWeight: 400, color: '#9CA3AF' }}>/月</span>
                    </p>
                    <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>{p.credits} 额度 · {p.durationDays} 天</p>
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      style={{
                        height: 40, borderRadius: 12, fontSize: 14, fontWeight: 600,
                        border: 'none', background: '#F97316', color: '#fff',
                        cursor: buying ? 'wait' : 'pointer', opacity: buying ? 0.5 : 1,
                        transition: 'background .2s', marginTop: 'auto',
                      }}
                    >
                      {buying === p.code ? '创建订单...' : user?.plan === p.plan ? '续费' : '订阅'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credits packs */}
          {creds.length > 0 && (
            <div>
              <p style={{ fontSize: 17, fontWeight: 600, color: '#171717', margin: '0 0 14px' }}>额度充值</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {creds.map(p => (
                  <div key={p.code} style={{
                    background: '#FFFFFF', border: '1px solid #E7E5E1', borderRadius: 16,
                    padding: 20, display: 'flex', flexDirection: 'column',
                    transition: 'border-color .2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,122,26,0.3)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E7E5E1')}
                  >
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#171717', margin: '0 0 8px' }}>{p.label}</p>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#171717', margin: '0 0 4px' }}>{p.amountLabel}</p>
                    <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>+{p.credits} 额度</p>
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      style={{
                        height: 40, borderRadius: 12, fontSize: 14, fontWeight: 600,
                        border: '2px solid #F97316', background: 'transparent', color: '#F97316',
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
