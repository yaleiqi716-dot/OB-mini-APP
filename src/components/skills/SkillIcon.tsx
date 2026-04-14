// Skills Hub — Brand logo icons
//
// Each skill gets its brand's original logo as inline SVG. Renders inside
// a 40×40 rounded container with --ob-surface-hi background. Connected
// skills show a small green checkmark in the bottom-right corner.
//
// Why inline SVG instead of image files:
// 1. No extra HTTP requests (icons are tiny, ~200-500 bytes each)
// 2. currentColor inheritance for monochrome variants
// 3. Tree-shaken — unused icons don't ship to the client
// 4. Dark-mode adaptation without separate asset sets

import React from 'react';

interface SkillIconProps {
  skillId: string;
  size?: number;        // container size, default 40
  connected?: boolean;  // show green checkmark badge
  className?: string;
}

// ── Brand color constants ────────────────────────────────────────────
const FEISHU_BLUE = '#3370FF';
const DINGTALK_BLUE = '#0089FF';
const WECOM_GREEN = '#07C160';
const WECHAT_GREEN = '#07C160';
const NOTION_WHITE = '#FFFFFF';
const GOOGLE_BLUE = '#4285F4';
const GOOGLE_GREEN = '#34A853';
const GOOGLE_YELLOW = '#FBBC05';
const GOOGLE_RED = '#EA4335';
const GMAIL_RED = '#EA4335';
const SLACK_AUBERGINE = '#E01E5A';
const SLACK_BLUE = '#36C5F0';
const SLACK_GREEN = '#2EB67D';
const SLACK_YELLOW = '#ECB22E';
const ZAPIER_ORANGE = '#FF4A00';
const XHS_RED = '#FE2C55';
const DOUYIN_BLUE = '#25F4EE';
const DOUYIN_RED = '#FE2C55';
const BILIBILI_BLUE = '#00A1D6';
const ZHIHU_BLUE = '#0066FF';
const WEIBO_RED = '#E6162D';
const TAOBAO_ORANGE = '#FF5000';
const MCP_PURPLE = '#7C3AED';
const GIT_ORANGE = '#F05032';
const SQLITE_BLUE = '#003B57';

// ── SVG Logo components ──────────────────────────────────────────────
// Each is a pure function returning an SVG element at the given size.
// Simplified but recognizable versions of official brand marks.

const logos: Record<string, (s: number) => React.ReactNode> = {
  // ─── Chinese platforms ─────────────────────────────────────────────

  feishu: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5.5 4L18 9L12 14L5.5 4Z" fill={FEISHU_BLUE} />
      <path d="M18 9L12 14L14 20L18 9Z" fill={FEISHU_BLUE} opacity={0.7} />
      <path d="M5.5 4L12 14L8 19L5.5 4Z" fill={FEISHU_BLUE} opacity={0.5} />
    </svg>
  ),

  dingtalk: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill={DINGTALK_BLUE} />
      <path d="M16.5 10.5L13 11.5L15 13L12.5 14.5L16 16L9 14L7.5 12L11 11L8 9L15.5 8L16.5 10.5Z" fill="#fff" />
    </svg>
  ),

  wecom: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M9.5 4C5.9 4 3 6.7 3 10c0 1.8.8 3.4 2.2 4.5L4.5 17l2.8-1.2c.7.2 1.4.3 2.2.3.2 0 .4 0 .6 0" fill={WECOM_GREEN} />
      <path d="M14.5 8c-3 0-5.5 2.2-5.5 5s2.5 5 5.5 5c.7 0 1.3-.1 1.9-.3L19 19l-.5-2.3C19.5 15.7 20 14.4 20 13c0-2.8-2.5-5-5.5-5z" fill={WECOM_GREEN} opacity={0.7} />
      <circle cx="8" cy="10" r="0.8" fill="#fff" />
      <circle cx="11" cy="10" r="0.8" fill="#fff" />
      <circle cx="13" cy="13" r="0.7" fill="#fff" />
      <circle cx="16" cy="13" r="0.7" fill="#fff" />
    </svg>
  ),

  wechat_mp: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M8.5 4C4.9 4 2 6.9 2 10.2c0 1.9 1 3.6 2.5 4.7l-.5 2.6 3-1.5c.8.2 1.6.3 2.5.3 .3 0 .5 0 .8 0" fill={WECHAT_GREEN} />
      <path d="M15.5 9c-3.3 0-6 2.3-6 5.2 0 2.8 2.7 5.2 6 5.2.7 0 1.3-.1 2-.3l2.5 1.2-.4-2.1c1.3-1 2.4-2.5 2.4-4.2C22 11.3 19.3 9 15.5 9z" fill={WECHAT_GREEN} opacity={0.7} />
      <circle cx="7" cy="9.5" r="0.8" fill="#fff" />
      <circle cx="10" cy="9.5" r="0.8" fill="#fff" />
    </svg>
  ),

  taobao_seller: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" fill={TAOBAO_ORANGE} />
      <path d="M8 7V5a4 4 0 018 0v2" stroke={TAOBAO_ORANGE} strokeWidth="2" fill="none" />
      <rect x="9" y="11" width="6" height="1" rx="0.5" fill="#fff" />
      <rect x="11.5" y="9.5" width="1" height="4" rx="0.5" fill="#fff" />
    </svg>
  ),

  douyin_creator: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M16.5 3v8.5a5 5 0 11-3-4.5V3h3z" fill={DOUYIN_RED} />
      <path d="M15 3.5v8a4.5 4.5 0 11-2.5-4V3.5H15z" fill={DOUYIN_BLUE} opacity={0.6} />
    </svg>
  ),

  xiaohongshu: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" fill={XHS_RED} />
      <path d="M8 8h8M12 8v8M8 12h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),

  bilibili: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="13" rx="3" fill={BILIBILI_BLUE} />
      <path d="M7 6L9.5 3M17 6L14.5 3" stroke={BILIBILI_BLUE} strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="13" r="1.5" fill="#fff" />
      <circle cx="15" cy="13" r="1.5" fill="#fff" />
      <circle cx="9" cy="13" r="0.7" fill={BILIBILI_BLUE} />
      <circle cx="15" cy="13" r="0.7" fill={BILIBILI_BLUE} />
    </svg>
  ),

  zhihu: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill={ZHIHU_BLUE} />
      <text x="12" y="16.5" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="bold" fontFamily="serif">知</text>
    </svg>
  ),

  weibo: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M10.5 20c-4.4 0-8-2.5-8-5.5 0-3 3.6-5.5 8-5.5s8 2.5 8 5.5c0 3-3.6 5.5-8 5.5z" fill={WEIBO_RED} />
      <ellipse cx="10.5" cy="14.5" rx="3.5" ry="2.5" fill="#fff" opacity={0.3} />
      <circle cx="17" cy="6" r="2" fill={WEIBO_RED} />
      <path d="M19 5a4 4 0 012 3.5" stroke={WEIBO_RED} strokeWidth="1.5" fill="none" />
    </svg>
  ),

  // ─── International platforms ───────────────────────────────────────

  notion: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="3" fill="#191919" />
      <rect x="3" y="2" width="18" height="20" rx="3" stroke="#555" strokeWidth="0.5" />
      <text x="12" y="16" textAnchor="middle" fill={NOTION_WHITE} fontSize="13" fontWeight="bold" fontFamily="serif">N</text>
    </svg>
  ),

  google_drive: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M8 4L2 14h6l6-10H8z" fill={GOOGLE_BLUE} />
      <path d="M14 4L8 14l3 6h10l-3-6H14z" fill={GOOGLE_GREEN} />
      <path d="M2 14l3 6h10l-3-6H2z" fill={GOOGLE_YELLOW} />
    </svg>
  ),

  gmail: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="#fff" />
      <path d="M2 6l10 7 10-7" stroke={GMAIL_RED} strokeWidth="1.8" fill="none" />
      <rect x="2" y="4" width="3" height="16" fill={GMAIL_RED} opacity={0.7} />
      <rect x="19" y="4" width="3" height="16" fill={GMAIL_RED} opacity={0.7} />
    </svg>
  ),

  slack: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="9" width="4" height="8" rx="2" fill={SLACK_GREEN} />
      <rect x="11" y="5" width="4" height="8" rx="2" fill={SLACK_BLUE} />
      <rect x="9" y="11" width="8" height="4" rx="2" fill={SLACK_YELLOW} />
      <rect x="5" y="15" width="8" height="4" rx="2" fill={SLACK_AUBERGINE} />
    </svg>
  ),

  zapier: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={ZAPIER_ORANGE} />
      <path d="M7 9h10L9 15h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),

  // ─── MCP / Tool icons ─────────────────────────────────────────────

  mcp: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill={MCP_PURPLE} />
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="#fff" strokeWidth="0.5" opacity={0.3} />
      <circle cx="12" cy="12" r="3" fill="#fff" opacity={0.9} />
    </svg>
  ),

  filesystem: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" fill="#6B7280" />
      <path d="M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" fill="#9CA3AF" />
    </svg>
  ),

  memory: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 4C8 4 5 7 5 10.5c0 2.5 1.5 4.5 3.5 6L8 20h8l-.5-3.5C17.5 15 19 13 19 10.5 19 7 16 4 12 4z" fill="#EC4899" opacity={0.8} />
      <path d="M9 12c0-1.7 1.3-3 3-3s3 1.3 3 3" stroke="#fff" strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="10" r="0.8" fill="#fff" />
      <circle cx="14" cy="10" r="0.8" fill="#fff" />
    </svg>
  ),

  sqlite: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="7" rx="8" ry="3" fill={SQLITE_BLUE} />
      <path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" fill={SQLITE_BLUE} opacity={0.7} />
      <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="#fff" strokeWidth="0.5" opacity={0.3} />
      <ellipse cx="12" cy="17" rx="8" ry="3" fill="none" stroke="#fff" strokeWidth="0.5" opacity={0.3} />
    </svg>
  ),

  git: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M21.6 11.3L12.7 2.4a1.4 1.4 0 00-2 0L8.5 4.6l2.5 2.5a1.7 1.7 0 012.2 2.2L15.6 12a1.7 1.7 0 011 3.1v.1a1.7 1.7 0 11-2-1.5l-2.2-2.2v5.8a1.7 1.7 0 11-1.8-.8V9.8a1.7 1.7 0 01-.9-2.2L7.2 5.1 2.4 9.9a1.4 1.4 0 000 2l8.9 8.9a1.4 1.4 0 002 0l8.3-8.3a1.4 1.4 0 000-2z" fill={GIT_ORANGE} />
    </svg>
  ),

  everything: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M8 3h3v4h2V3h3l-4 6-4-6z" fill="#10B981" />
      <rect x="6" y="10" width="12" height="11" rx="2" fill="#10B981" opacity={0.8} />
      <circle cx="10" cy="15" r="1" fill="#fff" />
      <circle cx="14" cy="15" r="1" fill="#fff" />
      <rect x="9" y="17.5" width="6" height="1" rx="0.5" fill="#fff" />
    </svg>
  ),

  custom_mcp: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#8B8B8B" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="3" fill="#8B8B8B" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.05 7.05l1.4 1.4M15.55 15.55l1.4 1.4M7.05 16.95l1.4-1.4M15.55 8.45l1.4-1.4" stroke="#8B8B8B" strokeWidth="1.2" />
    </svg>
  ),

  custom_webhook: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="12" r="3" stroke="#8B8B8B" strokeWidth="1.5" fill="none" />
      <circle cx="18" cy="12" r="3" stroke="#8B8B8B" strokeWidth="1.5" fill="none" />
      <path d="M9 12h6" stroke="#8B8B8B" strokeWidth="1.5" />
      <path d="M13 10l2 2-2 2" stroke="#8B8B8B" strokeWidth="1.2" fill="none" />
    </svg>
  ),

  generic: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#8B8B8B" strokeWidth="1.5" fill="none" />
      <path d="M8 12h8M12 8v8" stroke="#8B8B8B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export default function SkillIcon({ skillId, size = 40, connected, className }: SkillIconProps) {
  const logoFn = logos[skillId] || logos.generic;
  const innerSize = Math.round(size * 0.55);

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className || ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: 'var(--ob-surface-hi)',
      }}
    >
      {logoFn(innerSize)}
      {connected && (
        <div
          className="absolute"
          style={{
            bottom: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--ob-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4.5" fill="#22C55E" />
            <path d="M3 5.2L4.5 6.5L7 3.8" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

/** List of all available skill icon IDs */
export const SKILL_ICON_IDS = Object.keys(logos);
