'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { NavHeader } from '@/components/NavHeader';

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
  qrUrl: string;
  amountLabel: string;
  orderId: string;
  onDone: (success: boolean) => void;
  onCancel: () => void;
}) {
  const [payState, setPayState] = useState<PayState>('pending');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxWait = 30; // seconds
  const elapsed = useRef(0);



  // Start polling immediately after QR modal opens
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
        } catch { /* network error, keep polling */ }
        // Timeout after maxWait seconds
        if (elapsed.current >= maxWait) {
          clearInterval(pollRef.current!);
          setPayState('failed');
          setTimeout(() => onDone(false), 1200);
        }
      }, 1000);
    }, 500);

    return () => {
      clearTimeout(startPoll);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-[340px] flex flex-col items-center gap-5 animate-flow-in">

        {/* Success state */}
        {payState === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-lg font-semibold" style={{color:'#111'}}>支付成功</p>
            <p className="text-sm" style={{color:'#888'}}>额度已到账，正在刷新...</p>
          </div>
        ) : payState === 'failed' ? (
          /* Failed state */
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <p className="text-lg font-semibold" style={{color:'#111'}}>支付失败</p>
            <p className="text-sm text-center" style={{color:'#888'}}>支付未完成或已超时，请重试</p>
            <button onClick={onCancel}
              className="mt-2 px-6 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              关闭
            </button>
          </div>
        ) : (
          /* Pending / Polling state */
          <>
            <div className="text-center">
              <p className="text-base font-semibold mb-1" style={{color:'#111'}}>微信扫码支付</p>
              <p className="text-2xl font-bold" style={{color:'#f97316'}}>{amountLabel}</p>
            </div>

            {/* QR code */}
            <div className="relative p-2 rounded-xl border-2 border-gray-200 bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
                alt="支付二维码" className="rounded-lg" width={180} height={180}
              />

            </div>

            {/* Status row */}
            <div className="flex flex-col items-center gap-2 w-full">
              {payState === 'polling' ? (
                <div className="flex items-center gap-2 text-sm" style={{color:'#444'}}>
                  <Spinner size="sm" />
                  <span>正在确认支付状态...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{color:'#444'}}>
                  <Spinner size="sm" />
                  <span>正在确认支付状态...</span>
                </div>
              )}
              {/* Progress bar */}
              <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{background:'#eee'}}>
                <div className="h-full rounded-full bg-orange-400 animate-progress-pulse" style={{width:'80%'}} />
              </div>
            </div>

            <p className="text-xs text-center" style={{color:'#aaa'}}>
              正在验证支付结果，请稍候...
            </p>
            <button onClick={onCancel} className="text-xs transition-colors" style={{color:'#aaa'}}>取消支付</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{qrUrl:string;orderId:string;amountLabel:string}|null>(null);
  const [toast, setToast] = useState<{text:string;ok:boolean}|null>(null);

  const showToast = (text: string, ok = true) => {
    setToast({text, ok});
    setTimeout(() => setToast(null), 3500);
  };

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
    setQrModal(null);
    setBuying(null);
    if (success) {
      showToast('支付成功！额度已到账', true);
      fetchUser();
    } else {
      showToast('支付未完成，请重试', false);
    }
  }

  async function handleBuy(code: string) {
    if (buying) return;
    setBuying(code);
    try {
      const res = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '创建订单失败，请重试', false);
        setBuying(null);
        return;
      }
      const product = products.find(p => p.code === code);
      setQrModal({
        qrUrl: data.codeUrl,
        orderId: data.orderId,
        amountLabel: product?.amountLabel || data.amountLabel || '¥19',
      });
    } catch {
      showToast('网络错误，请重试', false);
      setBuying(null);
    }
  }

  const subs = products.filter(p => p.type === 'subscription');
  const creds = products.filter(p => p.type === 'credits');

  if (loading) return (
    <div className="h-[100dvh] flex items-center justify-center bg-surface-primary">
      <Spinner size="md"/>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-surface-primary">
      <NavHeader />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {user ? (
          <div className="rounded-2xl border border-border bg-surface-secondary p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-content-tertiary mb-1">当前套餐</div>
                <span className="text-xl font-bold text-content-primary uppercase">{user.plan}</span>
                {user.expireAt ? (
                  <span className="text-xs text-content-tertiary ml-2">
                    到期：{new Date(user.expireAt).toLocaleDateString('zh-CN')}
                  </span>
                ) : null}
              </div>
              <div className="text-right">
                <div className="text-xs text-content-tertiary mb-1">剩余额度</div>
                <div className={`text-3xl font-bold tabular-nums ${user.credits < 20 ? 'text-red-400' : 'text-accent'}`}>
                  {user.credits}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Subscription plans */}
        {subs.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-content-primary mb-4">订阅套餐</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subs.map(p => (
                <div key={p.code} className="rounded-2xl border border-border bg-surface-secondary p-5 flex flex-col hover:border-accent/40 transition-colors">
                  <div className="text-sm font-semibold text-content-primary">{p.label}</div>
                  <div className="text-3xl font-bold text-accent mt-2">
                    {p.amountLabel}
                    <span className="text-xs text-content-tertiary font-normal">/月</span>
                  </div>
                  <div className="text-xs text-content-tertiary mt-2">{p.credits} 额度 · {p.durationDays} 天</div>
                  <div className="mt-auto pt-5">
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50"
                    >
                      {buying === p.code ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner size="sm"/>创建订单...
                        </span>
                      ) : user?.plan === p.plan ? '续费' : '订阅'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Credits packs */}
        {creds.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-content-primary mb-4">额度充值</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {creds.map(p => (
                <div key={p.code} className="rounded-2xl border border-border bg-surface-secondary p-5 flex flex-col hover:border-accent/40 transition-colors">
                  <div className="text-sm font-semibold text-content-primary">{p.label}</div>
                  <div className="text-3xl font-bold text-content-primary mt-2">{p.amountLabel}</div>
                  <div className="text-xs text-content-tertiary mt-2">+{p.credits} 额度</div>
                  <div className="mt-auto pt-5">
                    <button
                      onClick={() => handleBuy(p.code)}
                      disabled={!!buying}
                      className="w-full py-2.5 rounded-xl border-2 border-accent text-accent text-sm font-semibold hover:bg-accent/10 transition-colors disabled:opacity-50"
                    >
                      {buying === p.code ? (
                        <span className="flex items-center justify-center gap-2">
                          <Spinner size="sm"/>创建订单...
                        </span>
                      ) : '购买'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}


      </div>

      {/* QR Modal */}
      {qrModal ? (
        <QRModal
          qrUrl={qrModal.qrUrl}
          amountLabel={qrModal.amountLabel}
          orderId={qrModal.orderId}
          onDone={handlePayDone}
          onCancel={() => { setQrModal(null); setBuying(null); }}
        />
      ) : null}

      {/* Toast */}
      {toast ? (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-flow-in px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? 'bg-green-500/90' : 'bg-red-500/90'}`}>
          {toast.ok ? (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {toast.text}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              {toast.text}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
