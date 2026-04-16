"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ──────────────────────────────────────────────────────────────
   HeroModern — adapted from 21st.dev (reapollo/hero-modern)
   Original: monochrome hero deck with animated SVG glyph,
   spotlight hover, mode toggle, entrance observer.
   Customised: dark-only, OrangeBench copy, orange accent,
   placeholder image, as second landing section.
   ────────────────────────────────────────────────────────────── */

const STYLE_ID = "hero3-animations";

const DeckGlyph = () => {
  const stroke = "#FF5A1F";
  const fill = "rgba(255,90,31,0.08)";

  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden>
      <circle
        cx="60"
        cy="60"
        r="46"
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        className="motion-safe:animate-[hero3-orbit_8.5s_linear_infinite] motion-reduce:animate-none"
        style={{ strokeDasharray: "18 14" }}
      />
      <rect
        x="34"
        y="34"
        width="52"
        height="52"
        rx="14"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.2"
        className="motion-safe:animate-[hero3-grid_5.4s_ease-in-out_infinite] motion-reduce:animate-none"
      />
      <circle cx="60" cy="60" r="7" fill={stroke} />
      <path
        d="M60 30v10M60 80v10M30 60h10M80 60h10"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinecap="round"
        className="motion-safe:animate-[hero3-pulse_6s_ease-in-out_infinite] motion-reduce:animate-none"
      />
    </svg>
  );
};

export default function HeroModern() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"agents" | "workflows">("agents");
  const sectionRef = useRef<HTMLElement>(null);

  /* ── Inject keyframe animations ────────────────────────────── */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.innerHTML = `
      @keyframes hero3-intro {
        0% { opacity: 0; transform: translate3d(0, 64px, 0) scale(0.98); filter: blur(12px); }
        60% { filter: blur(0); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
      }
      @keyframes hero3-card {
        0% { opacity: 0; transform: translate3d(0, 32px, 0) scale(0.95); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }
      @keyframes hero3-orbit {
        0% { stroke-dashoffset: 0; transform: rotate(0deg); }
        100% { stroke-dashoffset: -64; transform: rotate(360deg); }
      }
      @keyframes hero3-grid {
        0%, 100% { transform: rotate(-2deg); opacity: 0.7; }
        50% { transform: rotate(2deg); opacity: 1; }
      }
      @keyframes hero3-pulse {
        0%, 100% { stroke-dasharray: 0 200; opacity: 0.2; }
        45%, 60% { stroke-dasharray: 200 0; opacity: 1; }
      }
      @keyframes hero3-glow {
        0%, 100% { opacity: 0.45; transform: translate3d(0,0,0); }
        50% { opacity: 0.9; transform: translate3d(0,-8px,0); }
      }
      @keyframes hero3-drift {
        0%, 100% { transform: translate3d(0,0,0) rotate(-3deg); }
        50% { transform: translate3d(0,-12px,0) rotate(3deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  /* ── Intersection observer entrance ────────────────────────── */
  useEffect(() => {
    if (!sectionRef.current || typeof window === "undefined") {
      setVisible(true);
      return;
    }

    const node = sectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ── Dark-only palette with orange accent ──────────────────── */
  const palette = {
    surface: "bg-[#0C0C0A] text-[#F5F5F4]",
    subtle: "text-[#A8A29E]",
    border: "border-[#1F1F1D]",
    card: "bg-[#111110]",
    accent: "bg-[#111110]",
    glow: "rgba(255,90,31,0.14)",
  };

  const metrics = [
    { label: "Avg task time", value: "4m" },
    { label: "Agents active", value: "12" },
    { label: "Accuracy", value: "97%" },
  ];

  const modes = useMemo(
    () => ({
      agents: {
        title: "AI Agent Hub",
        description:
          "Deploy specialised AI agents that handle research, writing, and analysis. Each agent works autonomously while keeping your team in the loop.",
        items: [
          "Multi-agent orchestration in parallel",
          "Context-aware task delegation",
          "Real-time progress visibility",
        ],
      },
      workflows: {
        title: "Unified Workflows",
        description:
          "Chain agents, approvals, and handoffs into repeatable pipelines. One workspace for ideation through delivery.",
        items: [
          "Drag-and-drop pipeline builder",
          "Conditional branching and loops",
          "Audit trail for every step",
        ],
      },
    }),
    []
  );

  const activeMode = modes[mode];

  const protocols = [
    {
      name: "Task intake",
      detail:
        "Describe what you need in plain language. OrangeBench parses intent, selects the right agent, and kicks off execution.",
      status: "Ready",
    },
    {
      name: "Agent sync",
      detail:
        "Agents collaborate in a shared timeline. Review intermediate outputs, redirect focus, or approve results inline.",
      status: "Live",
    },
    {
      name: "Ship & iterate",
      detail:
        "Export deliverables, trigger downstream actions, and feed learnings back into the system for next time.",
      status: "Armed",
    },
  ];

  const setSpotlight = (event: React.MouseEvent<HTMLLIElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--hero3-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--hero3-y", `${event.clientY - rect.top}px`);
  };

  const clearSpotlight = (event: React.MouseEvent<HTMLLIElement>) => {
    event.currentTarget.style.removeProperty("--hero3-x");
    event.currentTarget.style.removeProperty("--hero3-y");
  };

  return (
    <div className={`relative isolate w-full transition-colors duration-700 ${palette.surface}`}>
      {/* Background layers */}
      <div
        className="pointer-events-none absolute inset-0 -z-30"
        style={{
          backgroundColor: "#0C0C0A",
          backgroundImage: [
            "radial-gradient(ellipse 80% 60% at 10% -10%, rgba(255,90,31,0.10), transparent 60%)",
            "radial-gradient(ellipse 90% 70% at 90% -20%, rgba(255,90,31,0.06), transparent 70%)",
          ].join(", "),
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-20 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(250,250,250,0.05) 0.7px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(250,250,250,0.05) 0.7px, transparent 1px)",
          backgroundSize: "12px 12px",
          backgroundRepeat: "repeat",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 10%, rgba(255,90,31,0.10), transparent 70%)",
          filter: "blur(22px)",
        }}
      />

      <section
        ref={sectionRef}
        className={`relative mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 py-24 transition-opacity duration-700 md:gap-20 ${
          visible
            ? "motion-safe:animate-[hero3-intro_1s_cubic-bezier(.22,.68,0,1)_forwards]"
            : "opacity-0"
        }`}
      >
        {/* ── Header row ─────────────────────────────────────── */}
        <header className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-end">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`inline-flex items-center gap-2 rounded-md border px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] ${palette.border} ${palette.accent}`}
              >
                AI-native workspace
              </span>
            </div>

            <div className="space-y-6">
              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                Built for teams that ship fast
              </h2>
              <p className={`max-w-2xl text-base md:text-lg ${palette.subtle}`}>
                Replace 5 tools with one AI-native workspace. OrangeBench
                handles research, planning, and execution in a single timeline.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className={`inline-flex flex-wrap gap-3 rounded-full border px-5 py-3 text-xs uppercase tracking-[0.3em] transition ${palette.border} ${palette.accent}`}
              >
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F] animate-pulse" />
                  All systems go
                </span>
                <span className="opacity-60">·</span>
                <span>Enterprise ready</span>
              </div>
              <div
                className={`flex divide-x divide-white/10 overflow-hidden rounded-lg border text-xs uppercase tracking-[0.35em] ${palette.border}`}
              >
                {metrics.map((metric) => (
                  <div key={metric.label} className="flex flex-col px-5 py-3">
                    <span className={`text-[11px] ${palette.subtle}`}>
                      {metric.label}
                    </span>
                    <span className="text-lg font-semibold tracking-tight">
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Mode card ──────────────────────────────────── */}
          <div
            className={`relative flex flex-col gap-6 rounded-xl border p-8 transition ${palette.border} ${palette.card}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.35em]">Mode</p>
                <h3 className="text-xl font-semibold tracking-tight">
                  {activeMode.title}
                </h3>
              </div>
              <DeckGlyph />
            </div>
            <p className={`text-sm leading-relaxed ${palette.subtle}`}>
              {activeMode.description}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("agents")}
                className={`flex-1 rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition ${
                  mode === "agents"
                    ? "border-[#FF5A1F] bg-[#FF5A1F] text-[#F5F5F4] hover:bg-[#FF6B35]"
                    : `${palette.border} ${palette.accent}`
                }`}
              >
                Agents
              </button>
              <button
                type="button"
                onClick={() => setMode("workflows")}
                className={`flex-1 rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition ${
                  mode === "workflows"
                    ? "border-[#FF5A1F] bg-[#FF5A1F] text-[#F5F5F4] hover:bg-[#FF6B35]"
                    : `${palette.border} ${palette.accent}`
                }`}
              >
                Workflows
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {activeMode.items.map((item) => (
                <li
                  key={item}
                  className={`flex items-start gap-3 ${palette.subtle}`}
                >
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#FF5A1F]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        {/* ── Three-column row ───────────────────────────────── */}
        <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] xl:items-stretch">
          {/* Left card — capabilities */}
          <div
            className={`order-2 flex flex-col gap-6 rounded-xl border p-8 transition ${palette.border} ${palette.card} xl:order-1`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.35em]">
                Capabilities
              </h3>
              <span className="text-xs uppercase tracking-[0.35em] opacity-60">
                v1.0
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${palette.subtle}`}>
              One workspace where agents, humans, and data converge. No
              tab-switching, no copy-pasting between tools.
            </p>
            <div className="grid gap-3">
              {[
                "Multi-agent parallel execution",
                "Contextual memory across tasks",
                "Team-wide shared timelines",
              ].map((item) => (
                <div
                  key={item}
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 text-xs uppercase tracking-[0.3em] transition duration-500 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(255,90,31,0.12)] ${palette.border}`}
                >
                  <span>{item}</span>
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 hover:opacity-100"
                    style={{
                      background: `radial-gradient(180px circle at 50% 20%, ${palette.glow}, transparent 70%)`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Center — product screenshot placeholder */}
          <figure
            className={`order-1 overflow-hidden rounded-xl border transition xl:order-2 ${palette.border}`}
            style={{ position: "relative" }}
          >
            <div className="relative w-full pb-[120%] sm:pb-[90%] lg:pb-[72%]">
              {/* Placeholder — swap with real screenshot later */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111110]">
                <div className="mb-4 h-16 w-16 rounded-xl bg-[#FF5A1F]/10 flex items-center justify-center">
                  <svg
                    className="h-8 w-8 text-[#FF5A1F]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-[#A8A29E]">
                  Product Screenshot
                </span>
              </div>
              {/* Decorative orbs (from original) */}
              <span className="pointer-events-none absolute -left-16 top-16 h-40 w-40 rounded-full border border-[#FF5A1F]/15 opacity-70 motion-safe:animate-[hero3-glow_9s_ease-in-out_infinite]" />
              <span className="pointer-events-none absolute -right-12 bottom-16 h-48 w-48 rounded-full border border-[#FF5A1F]/10 opacity-40 motion-safe:animate-[hero3-drift_12s_ease-in-out_infinite]" />
            </div>
            <figcaption
              className={`flex items-center justify-between px-6 py-5 text-xs uppercase tracking-[0.35em] ${palette.subtle}`}
            >
              <span>OrangeBench workspace</span>
              <span className="flex items-center gap-2">
                <span className="h-1 w-8 bg-[#FF5A1F]" />
                Unified timeline
              </span>
            </figcaption>
          </figure>

          {/* Right card — launch protocols */}
          <aside
            className={`order-3 flex flex-col gap-6 rounded-xl border p-8 transition ${palette.border} ${palette.card}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-[0.35em]">
                How it works
              </h3>
              <span className="text-xs uppercase tracking-[0.35em] opacity-60">
                3 steps
              </span>
            </div>
            <ul className="space-y-4">
              {protocols.map((protocol, index) => (
                <li
                  key={protocol.name}
                  onMouseMove={setSpotlight}
                  onMouseLeave={clearSpotlight}
                  className={`group relative overflow-hidden rounded-xl border px-5 py-4 transition duration-500 hover:-translate-y-0.5 ${palette.border}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(190px circle at var(--hero3-x, 50%) var(--hero3-y, 50%), rgba(255,90,31,0.18), transparent 72%)",
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.25em]">
                      {protocol.name}
                    </h4>
                    <span className="text-[10px] uppercase tracking-[0.35em] opacity-70">
                      {protocol.status}
                    </span>
                  </div>
                  <p className={`mt-3 text-sm leading-relaxed ${palette.subtle}`}>
                    {protocol.detail}
                  </p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
