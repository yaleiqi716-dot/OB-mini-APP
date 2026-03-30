'use client';

import { useState, useEffect, useRef, memo } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
}

// Memoized to prevent parent re-renders from resetting the animation.
// Only re-runs when `text` actually changes.
export const Typewriter = memo(function Typewriter({ text, speed = 30, className }: TypewriterProps) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const completedTextRef = useRef('');

  useEffect(() => {
    // If this text was already fully displayed, show it instantly
    if (text === completedTextRef.current) {
      setDisplayed(text);
      return;
    }

    // New text — start typing from scratch
    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        completedTextRef.current = text;
        clearInterval(interval);
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  const isTyping = displayed.length < text.length;

  return (
    <span className={className}>
      {displayed}
      {isTyping ? (
        <span className="inline-block w-0.5 h-3.5 bg-accent/60 ml-0.5 animate-pulse align-middle" />
      ) : null}
    </span>
  );
});
