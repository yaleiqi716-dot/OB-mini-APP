// Part of OrangeBench product internal design system
// Copied from agent-legacy/Typewriter.tsx — append-mode character reveal
"use client";

import { useState, useEffect, useRef, memo } from "react";

interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
}

export const Typewriter = memo(
  function Typewriter({ text, speed = 30, className }: TypewriterProps) {
    const [displayed, setDisplayed] = useState(text);
    const prevTextRef = useRef(text);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
      const prev = prevTextRef.current;
      if (text === prev) return;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      prevTextRef.current = text;

      const isAppend = text.startsWith(prev) && prev.length > 0;
      let idx = isAppend ? prev.length : 0;
      if (!isAppend) setDisplayed("");

      timerRef.current = setInterval(() => {
        idx++;
        if (idx >= text.length) {
          setDisplayed(text);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
        } else {
          setDisplayed(text.slice(0, idx));
        }
      }, speed);

      return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
    }, [text, speed]);

    const isTyping = displayed.length < text.length;

    return (
      <span className={className}>
        {displayed}
        {isTyping && <span className="inline-block w-0.5 h-3.5 bg-primary/60 ml-0.5 animate-pulse align-middle" />}
      </span>
    );
  },
  (prev, next) => prev.text === next.text && prev.speed === next.speed
);
