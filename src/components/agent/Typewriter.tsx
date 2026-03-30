'use client';

import { useState, useEffect, useRef } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function Typewriter({ text, speed = 30, onComplete, className }: TypewriterProps) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const prevTextRef = useRef('');

  useEffect(() => {
    // Reset when text changes
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      indexRef.current = 0;
      setDisplayed('');
    }

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        indexRef.current++;
        setDisplayed(text.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length ? (
        <span className="inline-block w-0.5 h-3.5 bg-accent/60 ml-0.5 animate-pulse align-middle" />
      ) : null}
    </span>
  );
}
