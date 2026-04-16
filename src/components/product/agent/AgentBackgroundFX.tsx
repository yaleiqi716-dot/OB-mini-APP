// Part of OrangeBench product internal design system
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AgentBackgroundFXProps {
  mode: "animate" | "static";
  onAnimationEnd?: () => void;
}

const DURATION = 2500;

export function AgentBackgroundFX({ mode, onAnimationEnd }: AgentBackgroundFXProps) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">(
    mode === "static" ? "done" : "idle"
  );
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (mode !== "animate") return;

    // Check prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      onAnimationEnd?.();
      return;
    }

    setPhase("running");
    timerRef.current = setTimeout(() => {
      setPhase("done");
      onAnimationEnd?.();
    }, DURATION);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mode, onAnimationEnd]);

  const isAnimating = phase === "running";
  const showFinal = phase === "done" || phase === "running";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Grid layer */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity",
          isAnimating ? "animate-[agentGridIn_2.5s_ease-out_forwards]" : showFinal ? "opacity-[0.06]" : "opacity-0"
        )}
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,90,31,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,90,31,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          willChange: isAnimating ? "opacity" : "auto",
        }}
      />

      {/* Central radial glow */}
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

      {/* Secondary purple glow (depth) */}
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

      {/* Ring */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
          isAnimating ? "animate-[agentRingExpand_2s_0.5s_ease-out_forwards]" : showFinal ? "opacity-[0.15]" : "opacity-0"
        )}
        style={{
          width: showFinal ? 500 : 0,
          height: showFinal ? 500 : 0,
          borderColor: "rgba(255,90,31,0.15)",
          willChange: isAnimating ? "transform, opacity" : "auto",
        }}
      />

      {/* Particles — 6 subtle dots */}
      {showFinal && (
        <div className="absolute inset-0">
          {PARTICLES.map((p) => (
            <div
              key={p.id}
              className={cn(
                "absolute rounded-full",
                isAnimating
                  ? "animate-[agentParticleFly_2s_ease-out_forwards]"
                  : "opacity-[0.3]"
              )}
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                top: `${p.y}%`,
                backgroundColor: p.color,
                animationDelay: isAnimating ? `${p.delay}s` : undefined,
                willChange: isAnimating ? "transform, opacity" : "auto",
              }}
            />
          ))}
        </div>
      )}

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

const PARTICLES = [
  { id: 1, x: 35, y: 30, size: 3, color: "rgba(255,90,31,0.4)", delay: 0.6 },
  { id: 2, x: 65, y: 35, size: 2, color: "rgba(255,90,31,0.3)", delay: 0.8 },
  { id: 3, x: 45, y: 60, size: 2, color: "rgba(120,80,200,0.3)", delay: 1.0 },
  { id: 4, x: 55, y: 25, size: 3, color: "rgba(255,90,31,0.35)", delay: 0.7 },
  { id: 5, x: 30, y: 55, size: 2, color: "rgba(120,80,200,0.25)", delay: 1.1 },
  { id: 6, x: 70, y: 50, size: 2, color: "rgba(255,90,31,0.3)", delay: 0.9 },
];
