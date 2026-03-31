'use client';

import { useEffect, useState, useCallback } from 'react';
import { Spinner } from '@/components/ui/Spinner';

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

export default function BillingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchUser = useCallback(() => {
    fetch('/api/user').then(r => r.json()).then(d => {
      if (d.credits !== undefined) setUser(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/billing/create-order').then(r => r.json()),
      fetch('/api/user').then(r => r.json()),
    ]).then(([prodData, userData]) => {
      if (prodData.products) setProducts(prodData.products);
      if (userData.credits !== undefined) setUser(userData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Poll order status
  useEffect(() => {
    if (!pollingOrderId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/order/${pollingOrderId}`);
        const data = await res.json();
        if (data.status === 'paid') {
          clearInterval(interval);
          setPollingOrderId(null);
          setQrUrl(null);
          setBuying(null);
          setToast('支付成功！');
          setTimeout(() => setToast(null), 3000);
          fetchUser();
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [pollingOrderId, fetchUser]);

  async function handleBuy(code: string) {
    setBuying(code);
    setQrUrl(null);
    try {
      const res = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error || '创建订单失败');
        setTimeout(() => setToast(null), 3000);
        setBuying(null);
        return;
      }
      setQrUrl(data.codeUrl);
      setPollingOrderId(data.orderId);
    } catch {
      setToast('网络错误');
      setTimeout(() => setToast(null), 3000);
      setBuying(null);
    }
  }

  const subscriptions = products.filter(p => p.type === 'subscription');
  const credits = products.filter(p => p.type === 'credits');

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-surface-primary">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface-primary">
      <header className="flex items-center justify-between px-4 md:px-6 h-11 border-b border-border/50">
        <div className="flex items-center gap-1">
          <span className="text-accent font-semibold text-sm">ORANGE</span>
          <span className="text-content-primary font-semibold text-sm">BENCH</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/tasks" className="text-xs text-content-tertiary hover:text-accent transition-colors">任务</a>
          <a href="/dashboard" className="text-xs text-content-tertiary hover:text-accent transition-colors">决策台</a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Current status */}
        {user ? (
          <div className="rounded-xl border border-border bg-surface-secondary p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-xs text-content-tertiary mb-1">当前套餐</div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-content-primary uppercase">{user.plan}</span>
                  {user.expireAt ? (
                    <span className="text-xs text-content-tertiary">
                      到期：{new Date(user.expireAt).toLocaleDateString('zh-CN')}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-content-tertiary mb-1">剩余额度</div>
                <div className={`text-2xl font-semibold ${user.credits < 20 ? 'text-red-400' : 'text-accent'}`}>
                  {user.credits}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* QR code modal */}
        {qrUrl ? (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 text-center space-y-4">
            <div className="text-sm text-content-primary font-medium">请扫码支付</div>
            {qrUrl.startsWith('/') ? (
              // Mock mode: show as link
              <div className="space-y-3">
                <p className="text-xs text-content-tertiary">开发模式：点击下方链接模拟支付</p>
                <a
                  href={qrUrl}
                  className="inline-block px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
                >
                  模拟支付
                </a>
              </div>
            ) : (
              // Real mode: show QR code URL (use a QR library in production)
              <div className="space-y-3">
                <p className="text-xs text-content-tertiary break-all">{qrUrl}</p>
                <p className="text-xs text-content-tertiary">请使用微信扫描上方二维码完成支付</p>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-xs text-content-tertiary">
              <Spinner size="sm" />
              <span>等待支付结果...</span>
            </div>
            <button
              onClick={() => { setQrUrl(null); setPollingOrderId(null); setBuying(null); }}
              className="text-xs text-content-tertiary hover:text-content-primary transition-colors"
            >
              取消支付
            </button>
          </div>
        ) : null}

        {/* Subscription plans */}
        <div>
          <h2 className="text-sm font-medium text-content-primary mb-3">订阅套餐</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subscriptions.map(p => (
              <div key={p.code} className="rounded-xl border border-border bg-surface-secondary p-5 flex flex-col">
                <div className="text-sm font-medium text-content-primary">{p.label}</div>
                <div className="text-2xl font-semibold text-accent mt-2">{p.amountLabel}<span className="text-xs text-content-tertiary font-normal">/月</span></div>
                <div className="text-xs text-content-tertiary mt-2">{p.credits} 额度 · {p.durationDays} 天</div>
                <div className="mt-auto pt-4">
                  <button
                    onClick={() => handleBuy(p.code)}
                    disabled={!!buying}
                    className="w-full py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                  >
                    {buying === p.code ? '创建订单...' : user?.plan === p.plan ? '续费' : '订阅'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Credits packs */}
        <div>
          <h2 className="text-sm font-medium text-content-primary mb-3">额度充值</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {credits.map(p => (
              <div key={p.code} className="rounded-xl border border-border bg-surface-secondary p-5 flex flex-col">
                <div className="text-sm font-medium text-content-primary">{p.label}</div>
                <div className="text-2xl font-semibold text-content-primary mt-2">{p.amountLabel}</div>
                <div className="text-xs text-content-tertiary mt-2">+{p.credits} 额度</div>
                <div className="mt-auto pt-4">
                  <button
                    onClick={() => handleBuy(p.code)}
                    disabled={!!buying}
                    className="w-full py-2 rounded-lg border border-accent text-accent text-sm font-medium hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    {buying === p.code ? '创建订单...' : '购买'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-flow-in">
          <div className="px-4 py-2 rounded-lg bg-accent/90 text-white text-sm shadow-lg">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}
