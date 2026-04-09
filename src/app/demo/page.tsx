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
  title: 'OrangeBench · 看 AI 怎么完成一个真实任务',
  description:
    '看 OrangeBench 完成一个真实的客户跟进任务：从收到需求到生成邮件草稿、检查格式、输出交付,全程无需登录。',
  openGraph: {
    title: 'OrangeBench · 看 AI 怎么完成一个真实任务',
    description: '不用注册,直接看 OrangeBench 跑一个真实的客户跟进任务。',
    url: 'https://orangebench.tech/demo',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrangeBench · 看 AI 怎么完成一个真实任务',
    description: '不用注册,直接看 OrangeBench 跑一个真实的客户跟进任务。',
  },
  alternates: {
    canonical: '/demo',
  },
};

// ── Pre-baked conversation data ──────────────────────────────────────
// Static. Hardcoded. This is intentionally not a real LLM call — it's
// a controlled product demonstration. Every visitor sees the exact
// same thing, so we can polish it deliberately.

const USER_PROMPT = '帮我给客户写一封简短的跟进邮件,确认下周三的会议。语气专业友好,最后带一个明确的回复 CTA。';

interface Step {
  label: string;
  detail: string;
  state: 'done';
}

const STEPS: Step[] = [
  { label: '理解需求', detail: '客户跟进邮件 · 会议确认 · 专业友好语气', state: 'done' },
  { label: '制定方案', detail: '选择 TEXT 路径 · 直接生成邮件草稿', state: 'done' },
  { label: '生成内容', detail: '结构:称呼 → 上下文 → 议题 → CTA → 签名', state: 'done' },
  { label: '检查输出', detail: '字数 142 · 语气得分 92/100 · 含明确 CTA', state: 'done' },
  { label: '整理交付', detail: '格式化为邮件正文,可直接复制发送', state: 'done' },
];

const RESULT_EMAIL = `主题:下周三产品评审会议确认

王总,您好,

感谢您上周对我们新版本的反馈。根据您的日程,我想确认一下我们计划在
下周三(4 月 16 日)下午 3 点的产品评审会议仍然按时进行。

议题:
  • 回顾上周讨论的 3 个关键反馈点
  • 演示已调整的产品方案
  • 对齐下阶段的落地时间表

会议预计 45 分钟,我会提前 10 分钟进会议室调试设备。

如果时间有变动,请在周二之前告诉我,我来重新协调。

期待周三见。

此致
李明
OrangeBench 产品团队`;

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
          DEMO · LIVE RUN · NO LOGIN
        </div>

        {/* Hero headline */}
        <h1
          style={{
            fontFamily: 'var(--ob-font-display)',
            fontSize: 'clamp(36px, 6vw, 56px)',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            margin: '0 0 16px',
            maxWidth: 720,
          }}
        >
          看 OrangeBench 跑一个<br />
          <span style={{ color: 'var(--ob-orange)' }}>真实任务</span>
        </h1>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: 'var(--ob-text-muted)',
            maxWidth: 620,
            margin: '0 0 40px',
          }}
        >
          下面是一个完整的任务执行过程。用户给出一句话指令,AI 拆解需求、
          生成内容、检查输出、整理交付 —— 5 步,约 8 秒。
          <strong style={{ color: 'var(--ob-text)' }}>不需要注册。</strong>
        </p>

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
            ORANGEBENCH · COMPLETED · 8.2s
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

          {/* Result block */}
          <div
            style={{
              background: 'var(--ob-bg)',
              border: '1px solid var(--ob-border)',
              borderRadius: 12,
              padding: 20,
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
              生成结果 · 可直接复制
            </div>
            <pre
              style={{
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 13,
                lineHeight: 1.65,
                color: 'var(--ob-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              }}
            >
              {RESULT_EMAIL}
            </pre>
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
              kicker: '01 · 一句话',
              title: '不填表,不拖拽',
              desc: '一行指令说清楚你要什么。没有字段、没有下拉菜单、没有模板选择器。',
            },
            {
              kicker: '02 · 8 秒',
              title: 'AI 拆 5 步执行',
              desc: '理解 → 规划 → 生成 → 检查 → 交付。每一步都看得见,不是黑盒。',
            },
            {
              kicker: '03 · 能直接用',
              title: '交付,不是草稿',
              desc: '输出就是你要发的那封邮件本身。改两处细节就能送出。',
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
            现在试试你自己的任务
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
            换成你的任务,结果会是什么样?
          </h2>
          <p
            style={{
              fontSize: 15,
              color: 'var(--ob-text-muted)',
              lineHeight: 1.55,
              maxWidth: 520,
              margin: '0 auto 28px',
            }}
          >
            注册只需要一个邮箱。新账号赠送 500 credits,
            够你跑 50+ 个类似的任务,看看它对你具体的工作场景能做到什么程度。
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
