'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

type Step = 'choose' | 'email' | 'code';

function LoginPageInner() {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect');
  const prefillEmail = searchParams.get('email');

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (hasSession) {
      // If redirect is an invite link, go there; otherwise go to agent
      if (redirectUrl && redirectUrl.startsWith('/invite/')) {
        router.replace(redirectUrl);
      } else {
        router.replace('/agent');
      }
    }
  }, [router, redirectUrl]);

  // Prefill email from invite link
  useEffect(() => {
    if (prefillEmail && !email) {
      setEmail(prefillEmail);
      setStep('email');
    }
  }, [prefillEmail, email]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleGoogleLogin() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    if (!clientId) {
      setError('Google 登录暂未配置，请使用邮箱验证码登录');
      return;
    }
    const stateObj = redirectUrl ? { redirect: redirectUrl } : {};
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${appUrl}/api/auth/google`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      ...(Object.keys(stateObj).length > 0 ? { state: encodeURIComponent(JSON.stringify(stateObj)) } : {}),
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async function handleSendCode() {
    if (!email || loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '发送失败'); return; }
      setStep('code'); setCountdown(60);
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(false); }
  }

  async function handleVerifyCode() {
    if (!code || loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '验证失败'); return; }
      // Redirect to invite page if that's where we came from, otherwise /agent
      if (redirectUrl && redirectUrl.startsWith('/invite/')) {
        router.replace(redirectUrl);
      } else {
        router.replace('/agent');
      }
    } catch { setError('网络错误，请重试'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-3xl font-black tracking-tight mb-2">
            <span className="text-orange-500">ORANGE</span>
            <span className="text-white">BENCH</span>
          </div>
          <p className="text-zinc-400 text-sm">AI 决策操作系统</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {step === 'choose' && (
            <>
              <h1 className="text-white text-xl font-semibold mb-1">欢迎回来</h1>
              <p className="text-zinc-400 text-sm mb-6">选择登录方式继续</p>
              <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 font-medium rounded-xl py-3 px-4 hover:bg-zinc-100 transition-colors mb-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                使用 Google 账号登录
              </button>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-zinc-700" />
                <span className="text-zinc-500 text-xs">或</span>
                <div className="flex-1 h-px bg-zinc-700" />
              </div>
              <button onClick={() => setStep('email')} className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-200 font-medium rounded-xl py-3 px-4 hover:bg-zinc-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                邮箱验证码登录
              </button>
              {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
            </>
          )}
          {step === 'email' && (
            <>
              <button onClick={() => { setStep('choose'); setError(''); }} className="flex items-center gap-1 text-zinc-400 text-sm mb-4 hover:text-zinc-200 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                返回
              </button>
              <h1 className="text-white text-xl font-semibold mb-1">邮箱登录</h1>
              <p className="text-zinc-400 text-sm mb-6">输入邮箱，我们将发送验证码</p>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendCode()} placeholder="your@email.com" autoFocus className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors mb-3" disabled={loading} />
              <button onClick={handleSendCode} disabled={!email.includes('@') || loading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 transition-colors">
                {loading ? '发送中…' : '发送验证码'}
              </button>
              {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
            </>
          )}
          {step === 'code' && (
            <>
              <button onClick={() => { setStep('email'); setError(''); setCode(''); }} className="flex items-center gap-1 text-zinc-400 text-sm mb-4 hover:text-zinc-200 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                返回
              </button>
              <h1 className="text-white text-xl font-semibold mb-1">输入验证码</h1>
              <p className="text-zinc-400 text-sm mb-6">已发送至 <span className="text-white">{email}</span></p>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()} placeholder="6 位验证码" autoFocus maxLength={6} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors mb-3 text-center text-2xl tracking-widest" disabled={loading} />
              <button onClick={handleVerifyCode} disabled={code.length !== 6 || loading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 transition-colors mb-3">
                {loading ? '验证中…' : '登录'}
              </button>
              <button onClick={() => { setStep('email'); setCode(''); setError(''); }} disabled={countdown > 0} className="w-full text-zinc-400 text-sm hover:text-zinc-200 disabled:cursor-not-allowed transition-colors">
                {countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送验证码'}
              </button>
              {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
            </>
          )}
        </div>
        <p className="text-zinc-600 text-xs text-center mt-6">登录即表示同意服务条款和隐私政策</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#0a0a0a' }} />}>
      <LoginPageInner />
    </Suspense>
  );
}
