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

function QRModal({ qrUrl, amountLabel, onSuccess, onCancel }: {
  qrUrl: string; amountLabel: string; onSuccess: () => void; onCancel: () => void;
}) {
  const [countdown, setCountdown] = useState(3);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setDone(true);
          setTimeout(onSuccess, 800);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-[340px] flex flex-col items-center gap-5 animate-flow-in">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-lg font-semibold" style={{color:'#111'}}>支付成功</p>
            <p className="text-sm" style={{color:'#888'}}>额度已到账，正在刷新...</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-base font-semibold mb-1" style={{color:'#111'}}>微信扫码支付</p>
              <p className="text-2xl font-bold" style={{color:'#f97316'}}>{amountLabel}</p>
            </div>
            <div className="relative p-2 rounded-xl border-2 border-gray-200 bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`}
                alt="支付二维码" className="rounded-lg" width={180} height={180}
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/5">
                <div className="bg-white/90 rounded-lg px-3 py-1.5 text-xs font-medium shadow" style={{color:'#444'}}>
                  Preview 模式
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-2 text-sm" style={{color:'#444'}}>
                <Spinner size="sm" />
                <span>模拟支付中... {countdown}s 后自动完成</span>
              </div>
              <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{background:'#eee'}}>
                <div className="h-full rounded-full transition-all duration-1000" style={{width:`${((3-countdown)/3)*100}%`,background:'#f97316'}} />
              </div>
            </div>
            <p className="text-xs text-center" style={{color:'#aaa'}}>Preview 模式：{countdown}s 后自动模拟支付成功</p>
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

  const showToast = (text: string, ok = true) => { setToast({text,ok}); setTimeout(()=>setToast(null),3500); };

  const fetchUser = useCallback(() => {
    fetch('/api/user').then(r=>r.json()).then(d=>{ if(d.credits!==undefined) setUser(d); }).catch(()=>{});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/create-order').then(r=>r.json()),
      fetch('/api/user').then(r=>r.json()),
    ]).then(([prod,usr])=>{
      if(prod.products) setProducts(prod.products);
      if(usr.credits!==undefined) setUser(usr);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  async function handlePaymentSuccess(orderId: string) {
    try {
      const res = await fetch(`/api/billing/order/${orderId}`);
      const data = await res.json();
      if (data.status === 'paid') { setQrModal(null); setBuying(null); showToast('支付成功！额度已到账'); fetchUser(); return; }
    } catch { /* ignore */ }
    setQrModal(null); setBuying(null); showToast('支付成功！额度已到账'); fetchUser();
  }

  async function handleBuy(code: string) {
    if (buying) return;
    setBuying(code);
    try {
      const res = await fetch('/api/billing/create-order', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({productCode:code}),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error||'创建订单失败',false); setBuying(null); return; }
      const product = products.find(p=>p.code===code);
      setQrModal({ qrUrl: data.codeUrl||'https://orangebench.tech/pay/preview', orderId:data.orderId, amountLabel:product?.amountLabel||data.amountLabel||'¥19' });
    } catch { showToast('网络错误，请重试',false); setBuying(null); }
  }

  const subs = products.filter(p=>p.type==='subscription');
  const creds = products.filter(p=>p.type==='credits');

  if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-surface-primary"><Spinner size="md"/></div>;

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
                {user.expireAt ? <span className="text-xs text-content-tertiary ml-2">到期：{new Date(user.expireAt).toLocaleDateString('zh-CN')}</span> : null}
              </div>
              <div className="text-right">
                <div className="text-xs text-content-tertiary mb-1">剩余额度</div>
                <div className={`text-3xl font-bold tabular-nums ${user.credits<20?'text-red-400':'text-accent'}`}>{user.credits}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="text-sm font-semibold text-content-primary mb-4">订阅套餐</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subs.map(p=>(
              <div key={p.code} className="rounded-2xl border border-border bg-surface-secondary p-5 flex flex-col hover:border-accent/40 transition-colors">
                <div className="text-sm font-semibold text-content-primary">{p.label}</div>
                <div className="text-3xl font-bold text-accent mt-2">{p.amountLabel}<span className="text-xs text-content-tertiary font-normal">/月</span></div>
                <div className="text-xs text-content-tertiary mt-2">{p.credits} 额度 · {p.durationDays} 天</div>
                <div className="mt-auto pt-5">
                  <button onClick={()=>handleBuy(p.code)} disabled={!!buying}
                    className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50">
                    {buying===p.code?<span className="flex items-center justify-center gap-2"><Spinner size="sm"/>创建订单...</span>:user?.plan===p.plan?'续费':'订阅'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-content-primary mb-4">额度充值</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creds.map(p=>(
              <div key={p.code} className="rounded-2xl border border-border bg-surface-secondary p-5 flex flex-col hover:border-accent/40 transition-colors">
                <div className="text-sm font-semibold text-content-primary">{p.label}</div>
                <div className="text-3xl font-bold text-content-primary mt-2">{p.amountLabel}</div>
                <div className="text-xs text-content-tertiary mt-2">+{p.credits} 额度</div>
                <div className="mt-auto pt-5">
                  <button onClick={()=>handleBuy(p.code)} disabled={!!buying}
                    className="w-full py-2.5 rounded-xl border-2 border-accent text-accent text-sm font-semibold hover:bg-accent/10 transition-colors disabled:opacity-50">
                    {buying===p.code?<span className="flex items-center justify-center gap-2"><Spinner size="sm"/>创建订单...</span>:'购买'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-secondary/50 p-4 text-xs text-content-tertiary text-center">
          Preview 模式：点击订阅/购买后显示模拟二维码，3秒后自动完成支付，额度实时更新。不影响未来真实支付接入。
        </div>
      </div>

      {qrModal ? (
        <QRModal
          qrUrl={qrModal.qrUrl}
          amountLabel={qrModal.amountLabel}
          onSuccess={()=>handlePaymentSuccess(qrModal.orderId)}
          onCancel={()=>{setQrModal(null);setBuying(null);}}
        />
      ) : null}

      {toast ? (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-flow-in px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok?'bg-green-500/90':'bg-red-500/90'}`}>
          {toast.ok?(
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {toast.text}
            </span>
          ):toast.text}
        </div>
      ):null}
    </div>
  );
}
