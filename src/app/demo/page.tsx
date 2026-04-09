import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * /demo — public, unauthenticated showcase.
 *
 * Why this exists: orangebench.tech previously required a full signup
 * before showing ANY product content. New visitors had to commit an email
 * + verification code + workspace concepts just to find out what the
 * product does. 95%+ bounced.
 *
 * This page shows ONE complete, realistic task run end-to-end with no
 * auth gate. Pre-baked: static HTML, zero LLM cost, zero DB writes,
 * instant load. The goal is 60-second product comprehension — not
 * interactive trial.
 *
 * Public path — see src/middleware.ts PUBLIC_PATHS.
 */

export const metadata: Metadata = {
  title: 'OrangeBench · 看 AI 8 秒做完一份运营周报',
  description:
    '每周五下午老板要周报,从 5 个平台拉数据、对比分析、写策略、发邮件 —— 一个人要 2 小时。OrangeBench 8 秒做完,可直接发给老板。无需登录即可查看。',
  openGraph: {
    title: 'OrangeBench · 看 AI 8 秒做完一份运营周报',
    description: '5 平台拉数据 · 对比分析 · 下周策略 · 可直接发邮件 —— 小团队每周都在重做的事,交给 AI。',
    url: 'https://orangebench.tech/demo',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrangeBench · 看 AI 8 秒做完一份运营周报',
    description: '5 平台拉数据 · 对比分析 · 下周策略 · 可直接发邮件 —— 小团队每周都在重做的事,交给 AI。',
  },
  alternates: {
    canonical: '/demo',
  },
};

// ── Pre-baked conversation data ──────────────────────────────────────
// Static. Hardcoded. This is intentionally not a real LLM call — it's
// a controlled product demonstration. Every visitor sees the exact
// same thing, so we can polish it deliberately.
//
// Scenario (aligned to the ICP conversation with the founder):
//   周报场景 — 小李是 6 人 SaaS 创业公司的运营同学,周五下午 17:15
//   老板 17:30 要本周运营周报。她需要从淘宝后台 + 抖音商家版 +
//   微信公众号 + 飞书文档 + 邮件 5 个平台拉数据,做对比分析,写
//   下周策略。上周花了 2 小时 45 分钟。
//
// Why this scenario over "write a follow-up email":
//   1. Universal pain — every SMB boss asks for weekly reports.
//   2. Shows the REAL OrangeBench differentiator — multi-step
//      workflow (拉数据 → 分析 → 策略 → 格式化) that ChatGPT can't
//      do end-to-end in one shot.
//   3. Directly addresses the founder's stated deepest pain:
//      "人为打开多个网页整理运营数据,既不专业,老板又要花时间
//       消化决策" — this demo IS that exact problem, solved.
//   4. Result is actually shippable (ready-to-send email to boss),
//      not a draft that still needs 30 minutes of editing.

const USER_PROMPT = '帮我生成本周运营周报:从淘宝/抖音/公众号后台拉取本周 GMV、曝光、转化数据,对比上周同期变化,找出 Top 3 增长和 Top 3 下滑的点,归因分析后给出下周 3 个可执行的策略建议,最后整理成可直接发给老板的邮件。';

interface Step {
  label: string;
  detail: string;
  state: 'done';
}

const STEPS: Step[] = [
  {
    label: '理解需求',
    detail: '周报 · 5 平台数据 · 对比分析 · 策略建议 · 邮件格式',
    state: 'done',
  },
  {
    label: '拉取数据',
    detail: '同步淘宝 · 抖音 · 公众号 · 飞书 · 邮件 · 本周 vs 上周',
    state: 'done',
  },
  {
    label: '分析洞察',
    detail: '识别 Top 3 增长 · Top 3 下滑 · 归因到品类与渠道',
    state: 'done',
  },
  {
    label: '生成策略',
    detail: '下周 3 个可执行建议 · 标注预期效果 · 分配 owner',
    state: 'done',
  },
  {
    label: '整理交付',
    detail: '邮件格式 · 决策点前置 · 老板 90 秒可读完',
    state: 'done',
  },
];

// ── Structured result data ──
// Replaces the previous 40-line <pre> email dump. The new visual
// canvas shows the same information as scannable cards: decision
// block (the hero), a 4-metric stat grid, two ranked columns for
// Top 3 increases + decreases, and 3 strategy cards with owners.
// Per the founder's feedback "重点表现呈现结果" — the result block
// IS the page's visual focal point, not a text wall.

const PLATFORMS = [
  { label: '淘宝', icon: 'shop' },
  { label: '抖音', icon: 'video' },
  { label: '公众号', icon: 'chat' },
  { label: '飞书', icon: 'doc' },
  { label: '邮件', icon: 'mail' },
] as const;

const DECISIONS = [
  {
    n: 1,
    title: '抖音直播预算是否加码 20%?',
    metric: 'ROI 1:5.8',
    metricLabel: '本周历史新高',
  },
  {
    n: 2,
    title: '公众号「新手入门」系列是否上付费推广?',
    metric: '31%',
    metricLabel: '自然打开率',
  },
  {
    n: 3,
    title: '淘宝「限时券」玩法本周失效,是否全面改「满减」?',
    metric: '−18%',
    metricLabel: '转化率下滑',
  },
] as const;

const METRICS = [
  { label: 'GMV', value: '¥287,450', delta: '+23.4%', up: true },
  { label: '总曝光', value: '1.24M', delta: '+8.1%', up: true },
  { label: '支付转化率', value: '3.84%', delta: '−0.22pp', up: false },
  { label: '新客占比', value: '42.3%', delta: '+5.6pp', up: true },
] as const;

const WINS = [
  { title: '抖音直播间', metric: '+67%', desc: '新品解说话术改版' },
  { title: '公众号「新手入门」', metric: '+54%', desc: '选题打中痛点' },
  { title: '淘宝手机壳类目', metric: '+41%', desc: '联名 IP 上架' },
] as const;

const LOSSES = [
  { title: '公众号图文(非新手系列)', metric: '−28%', desc: '边际递减 3 周' },
  { title: '淘宝「限时券」活动', metric: '−18%', desc: '用户疲劳,需换玩法' },
  { title: '邮件 EDM', metric: '−12%', desc: '周三时间点疑似冲突' },
] as const;

const STRATEGIES = [
  {
    n: 1,
    plan: '抖音:加码直播预算 +20%,锁定"新品解说话术"为标准 SOP',
    owner: '小张',
    expect: 'GMV +15K',
  },
  {
    n: 2,
    plan: '公众号:「新手入门」转付费推广,停图文推送 2 周',
    owner: '小王',
    expect: '新粉 +800',
  },
  {
    n: 3,
    plan: '淘宝:「限时券」改「满 199 减 30」,周一上线',
    owner: '小李',
    expect: '转化回到 4.0%',
  },
] as const;

// Small SVG icon set — keeps the page self-contained (no external image assets).
function PlatformIcon({ name }: { name: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'shop')
    return (
      <svg {...common}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );
  if (name === 'video')
    return (
      <svg {...common}>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  if (name === 'chat')
    return (
      <svg {...common}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  if (name === 'doc')
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  if (name === 'mail')
    return (
      <svg {...common}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  return null;
}

export default function DemoPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--ob-bg)',
        color: 'var(--ob-text)',
        fontFamily: 'var(--ob-font-body)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background wordmark watermark — same motif as /login */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'var(--ob-font-display)',
          fontWeight: 800,
          fontSize: 'clamp(200px, 24vw, 420px)',
          lineHeight: 0.82,
          letterSpacing: '-0.04em',
          color: 'var(--ob-surface)',
          opacity: 0.35,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        ORANGEBENCH
      </div>

      {/* ── Top nav ───────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '28px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: 'var(--ob-font-display)',
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: '-0.025em',
            textDecoration: 'none',
          }}
        >
          <span style={{ color: 'var(--ob-orange)' }}>ORANGE</span>
          <span style={{ color: 'var(--ob-text)' }}>BENCH</span>
        </Link>
        <Link
          href="/login"
          style={{
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ob-text)',
            textDecoration: 'none',
            padding: '10px 18px',
            border: '1px solid var(--ob-border)',
            borderRadius: 8,
            background: 'var(--ob-surface)',
          }}
        >
          开始用 →
        </Link>
      </nav>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 880,
          margin: '0 auto',
          padding: '24px 24px 80px',
        }}
      >
        {/* Editorial kicker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 16,
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--ob-orange)',
          }}
        >
          <span style={{ width: 48, height: 2, background: 'var(--ob-orange)' }} />
          DEMO · 运营周报 · 本周真实任务
        </div>

        {/* Hero headline — tightened, one line of copy */}
        <h1
          style={{
            fontFamily: 'var(--ob-font-display)',
            fontSize: 'clamp(34px, 5.4vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            margin: '0 0 14px',
            maxWidth: 760,
          }}
        >
          周五 17:15,老板 15 分钟后要周报。<br />
          <span style={{ color: 'var(--ob-orange)' }}>AI 帮你 8 秒搞定。</span>
        </h1>

        {/* Compact meta row instead of a 3-line intro para */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 10,
            margin: '0 0 28px',
            fontFamily: 'var(--ob-font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ob-text-muted)',
          }}
        >
          <span>运营同学 · 小李 · 6 人 SaaS 团队</span>
          <span style={{ color: 'var(--ob-text-dim)' }}>·</span>
          <span>上周耗时 2h45m</span>
          <span style={{ color: 'var(--ob-text-dim)' }}>·</span>
          <span style={{ color: 'var(--ob-orange)' }}>本周 8.4 秒</span>
        </div>

        {/* ── Conversation canvas ─────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--ob-surface)',
            border: '1px solid var(--ob-border)',
            borderRadius: 16,
            padding: 28,
            marginBottom: 28,
          }}
        >
          {/* User message bubble */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
            <div
              style={{
                maxWidth: '76%',
                padding: '14px 18px',
                background: 'var(--ob-orange)',
                color: '#0B0B0C',
                borderRadius: 14,
                fontSize: 15,
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              {USER_PROMPT}
            </div>
          </div>

          {/* Agent label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              fontFamily: 'var(--ob-font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ob-text-muted)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--ob-success)',
              }}
            />
            ORANGEBENCH · COMPLETED · 8.4s · 拉了 5 个平台
          </div>

          {/* Step timeline */}
          <div
            style={{
              borderLeft: '2px solid var(--ob-border)',
              paddingLeft: 20,
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {STEPS.map((step, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {/* Dot marker */}
                <span
                  style={{
                    position: 'absolute',
                    left: -27,
                    top: 4,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--ob-success)',
                    border: '2px solid var(--ob-bg)',
                  }}
                />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ob-text)',
                    marginBottom: 3,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ob-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {step.detail}
                </div>
              </div>
            ))}
          </div>

          {/* ── Result canvas — visual, not a text wall ──────────── */}
          <div
            style={{
              background: 'var(--ob-bg)',
              border: '1px solid var(--ob-border)',
              borderRadius: 12,
              padding: 22,
            }}
          >
            {/* Result header + platform chip row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 20,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-orange)',
                }}
              >
                生成结果 · 第 15 周运营周报
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                {PLATFORMS.map((p) => (
                  <span
                    key={p.label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 9px',
                      borderRadius: 9999,
                      background: 'var(--ob-surface)',
                      border: '1px solid var(--ob-border)',
                      fontSize: 11,
                      color: 'var(--ob-text-muted)',
                      fontFamily: 'var(--ob-font-body)',
                    }}
                  >
                    <span style={{ color: 'var(--ob-success)' }}>
                      <PlatformIcon name={p.icon} />
                    </span>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Decision block — THE HERO of the result ── */}
            <div
              style={{
                background: 'var(--ob-surface)',
                border: '1px solid var(--ob-border)',
                borderLeft: '3px solid var(--ob-orange)',
                borderRadius: 10,
                padding: '18px 20px',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-orange)',
                  marginBottom: 14,
                }}
              >
                需要老板决策的 3 件事
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {DECISIONS.map((d) => (
                  <div
                    key={d.n}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: 'var(--ob-orange)',
                        color: '#0B0B0C',
                        fontFamily: 'var(--ob-font-mono)',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {d.n}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--ob-text)',
                          lineHeight: 1.4,
                          marginBottom: 3,
                        }}
                      >
                        {d.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: 'var(--ob-font-mono)',
                          color: 'var(--ob-text-muted)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        <span style={{ color: 'var(--ob-orange)', fontWeight: 600 }}>
                          {d.metric}
                        </span>{' '}
                        · {d.metricLabel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Metric grid — 4 stat cards ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 10,
                marginBottom: 18,
              }}
            >
              {METRICS.map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: 'var(--ob-surface)',
                    border: '1px solid var(--ob-border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--ob-font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--ob-text-muted)',
                      marginBottom: 6,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--ob-font-display)',
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--ob-text)',
                      letterSpacing: '-0.01em',
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    {m.value}
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 11,
                      fontFamily: 'var(--ob-font-mono)',
                      fontWeight: 600,
                      color: m.up ? 'var(--ob-success)' : 'var(--ob-error)',
                    }}
                  >
                    <span>{m.up ? '↑' : '↓'}</span>
                    <span>{m.delta.replace(/[+−]/, '')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Top 3 wins + losses, 2-column ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
                marginBottom: 18,
              }}
            >
              {/* Wins */}
              <div
                style={{
                  background: 'var(--ob-surface)',
                  border: '1px solid var(--ob-border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ob-success)',
                    marginBottom: 12,
                  }}
                >
                  ↑ 增长 Top 3
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {WINS.map((w, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--ob-font-mono)',
                          fontSize: 11,
                          color: 'var(--ob-text-dim)',
                          marginTop: 2,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--ob-text)',
                            }}
                          >
                            {w.title}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'var(--ob-font-mono)',
                              fontWeight: 600,
                              color: 'var(--ob-success)',
                              flexShrink: 0,
                            }}
                          >
                            {w.metric}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--ob-text-muted)',
                            lineHeight: 1.4,
                            marginTop: 1,
                          }}
                        >
                          {w.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losses */}
              <div
                style={{
                  background: 'var(--ob-surface)',
                  border: '1px solid var(--ob-border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--ob-error)',
                    marginBottom: 12,
                  }}
                >
                  ↓ 下滑 Top 3
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {LOSSES.map((l, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--ob-font-mono)',
                          fontSize: 11,
                          color: 'var(--ob-text-dim)',
                          marginTop: 2,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--ob-text)',
                            }}
                          >
                            {l.title}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: 'var(--ob-font-mono)',
                              fontWeight: 600,
                              color: 'var(--ob-error)',
                              flexShrink: 0,
                            }}
                          >
                            {l.metric}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--ob-text-muted)',
                            lineHeight: 1.4,
                            marginTop: 1,
                          }}
                        >
                          {l.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Strategy cards — 3 actionable plans with owner chips ── */}
            <div
              style={{
                background: 'var(--ob-surface)',
                border: '1px solid var(--ob-border)',
                borderRadius: 10,
                padding: '14px 16px 16px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-orange)',
                  marginBottom: 12,
                }}
              >
                → 下周 3 个可执行策略
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {STRATEGIES.map((s) => (
                  <div
                    key={s.n}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: 'var(--ob-orange-a10, rgba(255,90,31,0.12))',
                        color: 'var(--ob-orange)',
                        fontFamily: 'var(--ob-font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {s.n}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--ob-text)',
                          lineHeight: 1.5,
                          marginBottom: 5,
                        }}
                      >
                        {s.plan}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          fontFamily: 'var(--ob-font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 9999,
                            background: 'var(--ob-surface-hi)',
                            border: '1px solid var(--ob-border)',
                            color: 'var(--ob-text-muted)',
                          }}
                        >
                          owner · {s.owner}
                        </span>
                        <span style={{ color: 'var(--ob-success)' }}>
                          预期 · {s.expect}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── What just happened ──────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 48,
          }}
        >
          {[
            {
              kicker: '01 · 从 2 小时到 8 秒',
              title: '时间戏剧性',
              desc: '小李上周花了 2 小时 45 分钟。本周 8.4 秒。这不是优化,是把一件事从"每周都要做"变成"顺手按一下"。',
            },
            {
              kicker: '02 · 拉数据 + 分析 + 策略 + 邮件',
              title: 'AI 拆 5 步,一气呵成',
              desc: '从 5 个平台拉本周数据、对比上周、找出增长和下滑、做归因、写下周策略、整理成邮件 —— 全部一个 prompt 搞定。ChatGPT 做不到这种端到端的 workflow。',
            },
            {
              kicker: '03 · 老板看了能决策',
              title: '3 个决策点前置',
              desc: 'AI 把需要老板拍板的 3 件事放在邮件最前面。老板 90 秒读完就能决策,不用再问"这个数据是怎么来的"或者"下周打算怎么做"。',
            },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                background: 'var(--ob-surface)',
                border: '1px solid var(--ob-border)',
                borderRadius: 12,
                padding: '22px 22px 20px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--ob-orange)',
                  marginBottom: 10,
                }}
              >
                {card.kicker}
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: 'var(--ob-text)',
                  marginBottom: 6,
                  fontFamily: 'var(--ob-font-display)',
                  letterSpacing: '-0.01em',
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ob-text-muted)',
                  lineHeight: 1.55,
                }}
              >
                {card.desc}
              </div>
            </div>
          ))}
        </div>

        {/* ── Closing CTA ─────────────────────────────────────────────── */}
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px 20px',
            borderTop: '1px solid var(--ob-border)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--ob-font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ob-orange)',
              marginBottom: 14,
            }}
          >
            周报只是其中一个场景
          </div>
          <h2
            style={{
              fontFamily: 'var(--ob-font-display)',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: '0 0 18px',
            }}
          >
            写朋友圈文案 · 客户跟进 · 招聘 JD<br />
            <span style={{ color: 'var(--ob-orange)' }}>都是同样的套路。</span>
          </h2>
          <p
            style={{
              fontSize: 15,
              color: 'var(--ob-text-muted)',
              lineHeight: 1.55,
              maxWidth: 560,
              margin: '0 auto 28px',
            }}
          >
            每天 2 小时的朋友圈、每周一次的客户会议纪要、每月一次的招聘 JD 和面试题 ——
            小团队每周都在重做的事,AI 帮你全部做完,你只负责审核。
            注册只要一个邮箱,新账号赠送 500 credits,够你跑 50+ 个真实任务。
          </p>
          <Link
            href="/login?redirect=%2Fagent"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 28px',
              background: 'var(--ob-orange)',
              color: '#0B0B0C',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'transform .15s cubic-bezier(.2,.7,.3,1)',
              fontFamily: 'var(--ob-font-body)',
            }}
          >
            开始免费使用 →
          </Link>
          <div
            style={{
              marginTop: 14,
              fontFamily: 'var(--ob-font-mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ob-text-dim)',
            }}
          >
            无需信用卡 · 60 秒注册 · 赠送 500 credits
          </div>
        </div>
      </main>
    </div>
  );
}
