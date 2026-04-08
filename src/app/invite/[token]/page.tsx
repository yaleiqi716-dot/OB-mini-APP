'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type InviteState = 'loading' | 'valid' | 'invalid' | 'accepting' | 'success' | 'error';

interface InviteInfo {
  workspaceName: string;
  email: string;
  role: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<InviteState>('loading');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login status
  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    setIsLoggedIn(hasSession);
  }, []);

  // Validate token
  useEffect(() => {
    fetch(`/api/workspace/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInfo({ workspaceName: data.workspaceName, email: data.email, role: data.role });
          setState('valid');
        } else {
          setState('invalid');
          if (data.reason === 'expired') setErrorMsg('邀请链接已过期');
          else if (data.reason === 'accepted') setErrorMsg('邀请已被接受');
          else if (data.reason === 'revoked') setErrorMsg('邀请已被撤销');
          else setErrorMsg('邀请链接已失效');
        }
      })
      .catch(() => {
        setState('invalid');
        setErrorMsg('验证邀请时出错');
      });
  }, [token]);

  async function handleAccept() {
    setState('accepting');
    try {
      const res = await fetch(`/api/workspace/invite/${token}/accept`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setState('success');
        setTimeout(() => router.push('/workspace'), 1500);
      } else if (res.status === 401) {
        // Not logged in — redirect to login with return URL
        router.push(`/login?redirect=/invite/${token}`);
      } else {
        setState('error');
        setErrorMsg(data.error || '加入失败');
      }
    } catch {
      setState('error');
      setErrorMsg('网络错误，请重试');
    }
  }

  function handleGoLogin() {
    const redirectUrl = `/invite/${token}`;
    const emailParam = info?.email ? `&email=${encodeURIComponent(info.email)}` : '';
    router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}${emailParam}`);
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#1E1C1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* Brand */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ color: '#FF5A1F', fontWeight: 700, fontSize: 20 }}>ORANGE</span>
          <span style={{ color: '#F5F5F5', fontWeight: 700, fontSize: 20 }}>BENCH</span>
        </div>

        <div style={{ background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 32 }}>
          {/* Loading */}
          {state === 'loading' && (
            <div style={{ padding: '24px 0' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #FF5A1F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, color: '#888888' }}>验证邀请链接...</p>
            </div>
          )}

          {/* Invalid */}
          {state === 'invalid' && (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#F5F5F5', marginBottom: 8 }}>邀请链接已失效</p>
              <p style={{ fontSize: 14, color: '#CCCCCC', marginBottom: 24 }}>{errorMsg || '请联系管理员重新发送邀请'}</p>
              <a href="/agent" style={{
                display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 18px',
                borderRadius: 9999, fontSize: 14, fontWeight: 500,
                background: '#FF5A1F', color: '#fff', textDecoration: 'none',
              }}>返回首页</a>
            </div>
          )}

          {/* Valid — logged in */}
          {state === 'valid' && isLoggedIn && info && (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,90,31,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF5A1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#F5F5F5', marginBottom: 6 }}>
                加入 {info.workspaceName}
              </p>
              <p style={{ fontSize: 14, color: '#CCCCCC', marginBottom: 24 }}>
                你被邀请作为{info.role === 'owner' ? '管理员' : '成员'}加入此工作区
              </p>
              <button
                onClick={handleAccept}
                aria-label="接受邀请"
                style={{
                  display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 24px',
                  borderRadius: 9999, fontSize: 15, fontWeight: 600, border: 'none',
                  background: '#FF5A1F', color: '#fff', cursor: 'pointer',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E63600')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FF5A1F')}
              >
                接受邀请
              </button>
            </div>
          )}

          {/* Valid — not logged in */}
          {state === 'valid' && !isLoggedIn && info && (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,90,31,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF5A1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#F5F5F5', marginBottom: 6 }}>
                加入 {info.workspaceName}
              </p>
              <p style={{ fontSize: 14, color: '#CCCCCC', marginBottom: 24 }}>
                请先登录或注册，即可加入工作区
              </p>
              <button
                onClick={handleGoLogin}
                aria-label="去登录"
                style={{
                  display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 24px',
                  borderRadius: 9999, fontSize: 15, fontWeight: 600, border: 'none',
                  background: '#FF5A1F', color: '#fff', cursor: 'pointer',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E63600')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FF5A1F')}
              >
                去登录
              </button>
            </div>
          )}

          {/* Accepting */}
          {state === 'accepting' && (
            <div style={{ padding: '24px 0' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #FF5A1F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14, color: '#888888' }}>正在加入工作区...</p>
            </div>
          )}

          {/* Success */}
          {state === 'success' && (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(16,185,129,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#F5F5F5', marginBottom: 8 }}>已加入工作区</p>
              <p style={{ fontSize: 14, color: '#CCCCCC' }}>正在跳转...</p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 600, color: '#F5F5F5', marginBottom: 8 }}>加入失败</p>
              <p style={{ fontSize: 14, color: '#CCCCCC', marginBottom: 24 }}>{errorMsg}</p>
              <button onClick={() => setState('valid')} style={{
                height: 30, padding: '0 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(255,255,255,0.04)', background: '#252321', color: '#888888', cursor: 'pointer',
              }}>重试</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
