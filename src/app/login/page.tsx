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
    if (loading) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    if (!clientId) {
      setError('Google 登录暂未配置，请使用邮箱验证码登录');
      return;
    }
    // Disable the button immediately so users don't double-click during the
    // couple hundred ms between click and full-page navigation.
    setLoading(true);
    setError('');
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

  // ─── OrangeBench Design System v1.2 login page ──────────────────
  // Follows DESIGN.md: Cabinet Grotesk wordmark, warm-dark tokens,
  // poster-scale typography, no dashed borders, solid editorial layout.

  const pageStyle: React.CSSProperties = {
    minHeight: '100dvh',
    background: 'var(--ob-bg)',
    color: 'var(--ob-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: 'var(--ob-font-body)',
    position: 'relative',
    overflow: 'hidden',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: 'var(--ob-surface)',
    border: '1px solid var(--ob-border)',
    borderRadius: 16,
    padding: '32px 32px 28px',
    position: 'relative',
    zIndex: 1,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--ob-text-muted)',
    marginBottom: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--ob-surface-hi)',
    border: '1px solid var(--ob-border)',
    borderRadius: 4,
    padding: '14px 16px',
    color: 'var(--ob-text)',
    fontSize: 15,
    fontFamily: 'var(--ob-font-body)',
    outline: 'none',
    transition: 'border-color .15s cubic-bezier(.2,.7,.3,1), box-shadow .15s cubic-bezier(.2,.7,.3,1)',
  };

  const primaryBtn: React.CSSProperties = {
    width: '100%',
    height: 48,
    background: 'var(--ob-orange)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'var(--ob-font-body)',
    cursor: 'pointer',
    transition: 'all .15s cubic-bezier(.2,.7,.3,1)',
    letterSpacing: '0.01em',
  };

  const googleBtn: React.CSSProperties = {
    width: '100%',
    height: 48,
    background: 'var(--ob-text)',
    color: '#121210',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'var(--ob-font-body)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all .15s cubic-bezier(.2,.7,.3,1)',
  };

  const secondaryBtn: React.CSSProperties = {
    width: '100%',
    height: 48,
    background: 'var(--ob-surface-hi)',
    color: 'var(--ob-text)',
    border: '1px solid var(--ob-border)',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'var(--ob-font-body)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all .15s cubic-bezier(.2,.7,.3,1)',
  };

  const backBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--ob-text-muted)',
    fontSize: 13,
    fontFamily: 'var(--ob-font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    cursor: 'pointer',
    padding: 0,
    marginBottom: 20,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'color .15s',
  };

  const errorStyle: React.CSSProperties = {
    color: 'var(--ob-error)',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center' as const,
    fontFamily: 'var(--ob-font-body)',
  };

  return (
    <div style={pageStyle}>
      {/* Editorial poster — huge wordmark cropped behind the card */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'var(--ob-font-display)',
          fontWeight: 800,
          fontSize: 'clamp(180px, 28vw, 440px)',
          lineHeight: 0.82,
          letterSpacing: '-0.04em',
          color: 'var(--ob-surface)',
          opacity: 0.5,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        ORANGEBENCH
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Top wordmark — real, not poster */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              fontFamily: 'var(--ob-font-display)',
              fontWeight: 800,
              fontSize: 36,
              letterSpacing: '-0.025em',
              lineHeight: 1,
              marginBottom: 10,
            }}
          >
            <span style={{ color: 'var(--ob-orange)' }}>ORANGE</span>
            <span style={{ color: 'var(--ob-text)' }}>BENCH</span>
          </div>
          <p
            style={{
              fontFamily: 'var(--ob-font-mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ob-text-muted)',
              margin: 0,
            }}
          >
            企业智能工作系统
          </p>
        </div>

        {/* Auth card */}
        <div style={cardStyle}>
          {step === 'choose' && (
            <>
              <div style={labelStyle}>
                <span style={{ color: 'var(--ob-orange)' }}>01</span> · 欢迎回来
              </div>
              <h1
                style={{
                  fontFamily: 'var(--ob-font-display)',
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: '-0.02em',
                  color: 'var(--ob-text)',
                  margin: '0 0 8px',
                  lineHeight: 1.15,
                }}
              >
                开始你的工作
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--ob-text-muted)',
                  margin: '0 0 24px',
                  lineHeight: 1.55,
                }}
              >
                选一个登录方式继续。你的任务、工作区和积分都在等着。
              </p>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{ ...googleBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 12 }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#E5E5E0'; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--ob-text)'; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? '正在跳转…' : '使用 Google 账号登录'}
              </button>

              {/* divider — solid line, not dashed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--ob-border)' }} />
                <span
                  style={{
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ob-text-dim)',
                  }}
                >
                  OR
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--ob-border)' }} />
              </div>

              <button
                onClick={() => setStep('email')}
                style={secondaryBtn}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ob-border-strong)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ob-border)'; }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                邮箱验证码登录
              </button>
              {error && <p style={errorStyle}>{error}</p>}
            </>
          )}

          {step === 'email' && (
            <>
              <button onClick={() => { setStep('choose'); setError(''); }} style={backBtn}>
                ← 返回
              </button>
              <div style={labelStyle}>
                <span style={{ color: 'var(--ob-orange)' }}>02</span> · 邮箱登录
              </div>
              <h1
                style={{
                  fontFamily: 'var(--ob-font-display)',
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: '-0.02em',
                  color: 'var(--ob-text)',
                  margin: '0 0 8px',
                  lineHeight: 1.15,
                }}
              >
                输入邮箱
              </h1>
              <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', margin: '0 0 20px' }}>
                我们会发一个 6 位验证码到你的邮箱。
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                placeholder="your@email.com"
                autoFocus
                disabled={loading}
                style={{ ...inputStyle, marginBottom: 12 }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ob-orange)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--ob-orange-ring)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ob-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={handleSendCode}
                disabled={!email.includes('@') || loading}
                style={{
                  ...primaryBtn,
                  opacity: (!email.includes('@') || loading) ? 0.5 : 1,
                  cursor: (!email.includes('@') || loading) ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (email.includes('@') && !loading) e.currentTarget.style.background = 'var(--ob-orange-lo)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ob-orange)'; }}
              >
                {loading ? '发送中…' : '发送验证码 →'}
              </button>
              {error && <p style={errorStyle}>{error}</p>}
            </>
          )}

          {step === 'code' && (
            <>
              <button onClick={() => { setStep('email'); setError(''); setCode(''); }} style={backBtn}>
                ← 返回
              </button>
              <div style={labelStyle}>
                <span style={{ color: 'var(--ob-orange)' }}>03</span> · 验证码
              </div>
              <h1
                style={{
                  fontFamily: 'var(--ob-font-display)',
                  fontWeight: 700,
                  fontSize: 28,
                  letterSpacing: '-0.02em',
                  color: 'var(--ob-text)',
                  margin: '0 0 8px',
                  lineHeight: 1.15,
                }}
              >
                输入 6 位数
              </h1>
              <p style={{ fontSize: 14, color: 'var(--ob-text-muted)', margin: '0 0 20px' }}>
                已发送至 <span style={{ color: 'var(--ob-text)', fontFamily: 'var(--ob-font-mono)', fontSize: 13 }}>{email}</span>
              </p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                placeholder="000000"
                autoFocus
                maxLength={6}
                disabled={loading}
                style={{
                  ...inputStyle,
                  marginBottom: 12,
                  fontFamily: 'var(--ob-font-mono)',
                  textAlign: 'center',
                  fontSize: 28,
                  letterSpacing: '0.4em',
                  padding: '16px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ob-orange)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--ob-orange-ring)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ob-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={handleVerifyCode}
                disabled={code.length !== 6 || loading}
                style={{
                  ...primaryBtn,
                  opacity: (code.length !== 6 || loading) ? 0.5 : 1,
                  cursor: (code.length !== 6 || loading) ? 'not-allowed' : 'pointer',
                  marginBottom: 12,
                }}
                onMouseEnter={(e) => { if (code.length === 6 && !loading) e.currentTarget.style.background = 'var(--ob-orange-lo)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ob-orange)'; }}
              >
                {loading ? '验证中…' : '登录 →'}
              </button>
              <button
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                disabled={countdown > 0}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: countdown > 0 ? 'var(--ob-text-dim)' : 'var(--ob-text-muted)',
                  fontSize: 13,
                  fontFamily: 'var(--ob-font-mono)',
                  cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                  padding: '8px 0',
                }}
              >
                {countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送验证码'}
              </button>
              {error && <p style={errorStyle}>{error}</p>}
            </>
          )}
        </div>

        <p
          style={{
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ob-text-dim)',
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          登录即表示同意 服务条款 · 隐私政策
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--ob-bg)' }} />}>
      <LoginPageInner />
    </Suspense>
  );
}
