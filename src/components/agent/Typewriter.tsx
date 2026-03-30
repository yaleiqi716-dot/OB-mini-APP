'use client';

import { useState, useEffect, useRef, memo } from 'react';

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
      // Same text — no action needed (handles parent re-renders)
      if (text === prevTextRef.current && displayed === text) return;

      // Text actually changed — start typing
      prevTextRef.current = text;
      let idx = 0;
      setDisplayed('');

      if (timerRef.current) clearInterval(timerRef.current);

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

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [text, speed]); // displayed intentionally excluded

    const isTyping = displayed.length < text.length;

    return (
      <span className={className}>
        {displayed}
        {isTyping ? (
          <span className="inline-block w-0.5 h-3.5 bg-accent/60 ml-0.5 animate-pulse align-middle" />
        ) : null}
      </span>
    );
  },
  (prev, next) => prev.text === next.text && prev.speed === next.speed
);
