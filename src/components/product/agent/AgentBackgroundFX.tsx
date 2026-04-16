// Part of OrangeBench product internal design system
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface AgentBackgroundFXProps {
  mode: "animate" | "static";
  onAnimationEnd?: () => void;
}

const DURATION = 2500;
const PARTICLE_COUNT = 40;

interface Particle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  isOrange: boolean;
  floatPhase: number;
  floatSpeed: number;
  floatAmp: number;
}

function createParticles(w: number, h: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: 1 + Math.random() * 2,
    alpha: 0.1 + Math.random() * 0.25,
    isOrange: Math.random() < 0.2,
    floatPhase: Math.random() * Math.PI * 2,
    floatSpeed: 0.3 + Math.random() * 0.5,
    floatAmp: 3 + Math.random() * 2,
  }));
}

export function AgentBackgroundFX({ mode, onAnimationEnd }: AgentBackgroundFXProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);
  const [phase, setPhase] = useState<"idle" | "running" | "done">(
    mode === "static" ? "done" : "idle"
  );

  const isReducedMotion = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Phase management
  useEffect(() => {
    if (mode !== "animate") return;
    if (isReducedMotion) {
      setPhase("done");
      onAnimationEnd?.();
      return;
    }
    setPhase("running");
    startRef.current = performance.now();
    const timer = setTimeout(() => {
      setPhase("done");
      onAnimationEnd?.();
    }, DURATION);
    return () => clearTimeout(timer);
  }, [mode, onAnimationEnd, isReducedMotion]);

  // Canvas particle loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();
    const elapsed = now - startRef.current;
    const progress = phase === "running" ? Math.min(elapsed / DURATION, 1) : 1;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    for (const p of particlesRef.current) {
      let px = p.x;
      let py = p.y;

      // During scatter: interpolate from center to final position
      if (phase === "running" && progress < 1) {
        const scatterT = Math.min((elapsed - 400) / 2100, 1);
        const eased = scatterT <= 0 ? 0 : 1 - Math.pow(1 - scatterT, 3);
        px = cx + (p.x - cx) * eased;
        py = cy + (p.y - cy) * eased;
      }

      // Float offset (always active after scatter completes)
      const t = now / 1000;
      const floatOffset = Math.sin(t * p.floatSpeed + p.floatPhase) * p.floatAmp;
      py += floatOffset;

      // Alpha: during scatter fade in
      let alpha = p.alpha;
      if (phase === "running") {
        const fadeT = Math.min((elapsed - 400) / 1000, 1);
        alpha = p.alpha * Math.max(fadeT, 0);
      }

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      if (p.isOrange) {
        ctx.fillStyle = `rgba(255,90,31,${alpha * 1.5})`;
      } else {
        ctx.fillStyle = `rgba(245,245,240,${alpha})`;
      }
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [phase]);

  // Init particles + start loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      particlesRef.current = createParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  const isAnimating = phase === "running";
  const showFinal = phase === "done" || phase === "running";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Layer 1: Grid */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity",
          isAnimating ? "animate-[agentGridIn_2.5s_ease-out_forwards]" : showFinal ? "opacity-60" : "opacity-0"
        )}
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,90,31,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,90,31,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Layer 2: Radial glow */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
          isAnimating ? "animate-[agentGlowExpand_2.5s_ease-out_forwards]" : showFinal ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: showFinal ? 900 : 0,
          height: showFinal ? 900 : 0,
          background: "radial-gradient(circle, rgba(255,90,31,0.12) 0%, rgba(255,90,31,0.04) 40%, transparent 70%)",
          willChange: isAnimating ? "transform, opacity" : "auto",
        }}
      />

      {/* Secondary purple glow */}
      <div
        className={cn(
          "absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 rounded-full",
          isAnimating ? "animate-[agentGlowExpand_2.5s_0.3s_ease-out_forwards]" : showFinal ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: showFinal ? 700 : 0,
          height: showFinal ? 700 : 0,
          background: "radial-gradient(circle, rgba(120,80,200,0.08) 0%, rgba(120,80,200,0.02) 50%, transparent 70%)",
          willChange: isAnimating ? "transform, opacity" : "auto",
        }}
      />

      {/* Layer 3: Canvas particles */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, #0C0C0A 100%)",
        }}
      />
    </div>
  );
}
