"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

/* ──────────────────────────────────────────────────────────────
   NavHeader — adapted from 21st.dev (krittyz/nav-header)
   Original: animated cursor following hover across nav tabs.
   Customised: full navbar with logo, links, CTA buttons,
   dark theme, sticky + backdrop-blur, scroll shadow.
   ────────────────────────────────────────────────────────────── */

const NAV_ITEMS = ["Features", "Pricing", "FAQ", "Docs"] as const;

function NavHeader() {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        "border-b",
        scrolled
          ? "bg-[#0C0C0A]/80 backdrop-blur-xl border-[#1F1F1D] shadow-lg shadow-black/20"
          : "bg-[#0C0C0A]/60 backdrop-blur-md border-transparent"
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-[#F5F5F4]">
          OrangeBench
        </Link>

        {/* Center nav — animated cursor from 21st.dev */}
        <ul
          className="relative mx-auto hidden items-center rounded-lg border border-[#1F1F1D] bg-[#111110] p-1 md:flex"
          onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
        >
          {NAV_ITEMS.map((item) => (
            <Tab key={item} setPosition={setPosition}>
              {item}
            </Tab>
          ))}
          <Cursor position={position} />
        </ul>

        {/* Right buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4] sm:inline-block"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#FF5A1F] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[#E84D15]"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ── Tab (from 21st.dev original) ────────────────────────────── */

const Tab = ({
  children,
  setPosition,
}: {
  children: React.ReactNode;
  setPosition: React.Dispatch<
    React.SetStateAction<{ left: number; width: number; opacity: number }>
  >;
}) => {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          width,
          opacity: 1,
          left: ref.current.offsetLeft,
        });
      }}
      className="relative z-10 cursor-pointer px-4 py-1.5 text-sm text-[#A8A29E] mix-blend-difference transition-colors duration-150"
    >
      {children}
    </li>
  );
};

/* ── Cursor (from 21st.dev original) ─────────────────────────── */

const Cursor = ({
  position,
}: {
  position: { left: number; width: number; opacity: number };
}) => {
  return (
    <motion.li
      animate={position}
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="absolute z-0 h-8 rounded-lg bg-[#FF5A1F]"
    />
  );
};

/* ── Utility ─────────────────────────────────────────────────── */

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default NavHeader;
