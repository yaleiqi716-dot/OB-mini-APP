'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader, WorkspaceSubNav } from '@/components/workspace/AppHeader';

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  email: string;
  name: string | null;
}

interface Invite {
  id: string;
  token: string;
  email: string;
  role: string;
  status: string;
  expired: boolean;
  expiresAt: string;
  createdAt: string;
}

export default function WorkspaceMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    const hasSession = document.cookie.includes('ob-session=') || document.cookie.includes('ob-user-id=');
    if (!hasSession) { router.replace('/login'); }
  }, [router]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/workspace/members').then(r => r.json()),
      fetch('/api/workspace/invite').then(r => r.json()),
      fetch('/api/workspace').then(r => r.json()),
    ]).then(([membersData, invitesData, wsData]) => {
      if (Array.isArray(membersData)) setMembers(membersData);
      if (Array.isArray(invitesData)) setInvites(invitesData);
      if (wsData?.role === 'owner') setIsOwner(true);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleInvite() {
    if (!inviteEmail.includes('@') || inviting) return;
    setInviting(true);
    try {
      const res = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('邀请已发送');
        setInviteEmail('');
        loadData();
      } else {
        showToast(data.error || '邀请失败');
      }
    } catch { showToast('网络错误'); }
    finally { setInviting(false); }
  }

  async function handleRevoke(inviteToken: string) {
    try {
      const res = await fetch(`/api/workspace/invite/${inviteToken}`, { method: 'DELETE' });
      if (res.ok) { showToast('邀请已撤销'); loadData(); }
      else showToast('撤销失败');
    } catch { showToast('网络错误'); }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('确定移除该成员？')) return;
    try {
      const res = await fetch(`/api/workspace/members/${memberId}`, { method: 'DELETE' });
      if (res.ok) { showToast('已移除'); loadData(); }
      else { const d = await res.json(); showToast(d.error || '移除失败'); }
    } catch { showToast('网络错误'); }
  }

  const actionBtn: React.CSSProperties = {
    height: 28, padding: '0 10px', borderRadius: 9999, fontSize: 12, fontWeight: 500,
    border: '1px solid rgba(255,255,255,0.04)', background: '#252321', color: '#888888', cursor: 'pointer',
    transition: 'border-color .2s, color .2s',
  };

  // header replaced by shared component

  const pendingInvites = invites.filter(i => i.status === 'pending' && !i.expired);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#1E1C1A' }}>
      <AppHeader />
      <WorkspaceSubNav />
      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 32px 60px' }}>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, color: '#F5F5F5', margin: '0 0 8px' }}>成员管理</h1>
            <p style={{ fontSize: 14, color: '#CCCCCC', margin: 0 }}>邀请成员加入工作区</p>
          </div>

          {/* Invite form (owner only) */}
          {isOwner && (
            <div style={{ background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F5', margin: '0 0 12px' }}>邀请新成员</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder="输入邮箱地址"
                  style={{
                    flex: 1, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)',
                    background: '#252321', padding: '0 14px', fontSize: 14, color: '#F5F5F5', outline: 'none',
                    transition: 'border-color .2s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#FF3D00')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}
                />
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail.includes('@') || inviting}
                  style={{
                    height: 40, padding: '0 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    border: 'none', background: '#FF3D00', color: '#fff', cursor: 'pointer',
                    opacity: (!inviteEmail.includes('@') || inviting) ? 0.5 : 1,
                    transition: 'background .2s',
                  }}
                >
                  {inviting ? '发送中...' : '发送邀请'}
                </button>
              </div>
            </div>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div style={{ background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F5', margin: '0 0 12px' }}>待接受邀请</p>
              {pendingInvites.map(inv => (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div>
                    <span style={{ fontSize: 14, color: '#F5F5F5' }}>{inv.email}</span>
                    <span style={{ fontSize: 12, color: '#CCCCCC', marginLeft: 8 }}>待接受</span>
                  </div>
                  {isOwner && (
                    <button onClick={() => handleRevoke(inv.token)} style={actionBtn}>撤销</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Members list */}
          <div style={{ background: '#252321', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#F5F5F5', margin: '0 0 12px' }}>
              当前成员 ({members.length})
            </p>
            {loading ? (
              <p style={{ fontSize: 14, color: '#CCCCCC', textAlign: 'center', padding: '20px 0' }}>加载中...</p>
            ) : members.length === 0 ? (
              <p style={{ fontSize: 14, color: '#CCCCCC', textAlign: 'center', padding: '20px 0' }}>暂无成员</p>
            ) : (
              members.map((m, i) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(255,61,0,0.10)', color: '#FF3D00',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600,
                    }}>
                      {(m.name || m.email || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#F5F5F5' }}>{m.name || m.email}</div>
                      {m.name && <div style={{ fontSize: 12, color: '#CCCCCC' }}>{m.email}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px',
                      borderRadius: 9999, fontSize: 11, fontWeight: 500,
                      background: m.role === 'owner' ? 'rgba(255,61,0,0.10)' : 'rgba(156,163,175,0.10)',
                      color: m.role === 'owner' ? '#C2410C' : '#888888',
                    }}>
                      {m.role === 'owner' ? 'Owner' : '成员'}
                    </span>
                    {isOwner && m.role !== 'owner' && (
                      <button onClick={() => handleRemoveMember(m.id)} style={actionBtn}>移除</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="animate-flow-in" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 60, padding: '10px 20px', borderRadius: 9999,
          background: 'rgba(34,197,94,0.92)', color: '#fff', fontSize: 13,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
