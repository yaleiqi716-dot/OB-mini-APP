"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";

/* ──────────────────────────────────────────────────────────────
   NavHeader — adapted from 21st.dev (krittyz/nav-header)
   Original: animated cursor following hover across nav tabs.
   Customised: full navbar with logo, links, CTA buttons,
   dark theme, sticky + backdrop-blur, scroll shadow,
   mobile drawer.
   ────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "#", title: "Coming soon" },
] as const;

function NavHeader() {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
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

          {/* Center nav — animated cursor (desktop only) */}
          <ul
            className="relative mx-auto hidden items-center rounded-lg border border-[#1F1F1D] bg-[#111110] p-1 md:flex"
            onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
          >
            {NAV_ITEMS.map((item) => (
              <Tab key={item.label} href={item.href} title={"title" in item ? item.title : undefined} setPosition={setPosition}>
                {item.label}
              </Tab>
            ))}
            <Cursor position={position} />
          </ul>

          {/* Right — desktop buttons + mobile hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4] md:inline-block"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="hidden rounded-lg bg-[#FF5A1F] px-4 py-2 text-sm font-medium text-[#F5F5F4] transition-all duration-150 hover:bg-[#FF6B35] md:inline-block"
            >
              Get Started
            </Link>
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4] md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeDrawer}
              className="fixed inset-0 z-[60] bg-[#0C0C0A]/80 backdrop-blur-sm"
            />
            {/* Drawer panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed top-0 right-0 bottom-0 z-[70] flex w-72 flex-col border-l border-[#1F1F1D] bg-[#0C0C0A]"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-4">
                <span className="text-sm font-bold text-[#F5F5F4]">Menu</span>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer links */}
              <div className="flex flex-1 flex-col gap-1 px-4">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    title={"title" in item ? item.title : undefined}
                    onClick={closeDrawer}
                    className="rounded-lg px-4 py-3 text-base font-medium text-[#A8A29E] transition-colors duration-150 hover:bg-[#111110] hover:text-[#F5F5F4]"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="my-3 border-t border-[#1F1F1D]" />

                <Link
                  href="/login"
                  onClick={closeDrawer}
                  className="rounded-lg px-4 py-3 text-base font-medium text-[#A8A29E] transition-colors duration-150 hover:bg-[#111110] hover:text-[#F5F5F4]"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={closeDrawer}
                  className="mt-2 flex items-center justify-center rounded-lg bg-[#FF5A1F] px-4 py-3 text-base font-medium text-[#F5F5F4] transition-all duration-150 hover:bg-[#FF6B35]"
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Tab (from 21st.dev original) ────────────────────────────── */

const Tab = ({
  children,
  href,
  title,
  setPosition,
}: {
  children: React.ReactNode;
  href: string;
  title?: string;
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
      className="relative z-10 cursor-pointer text-sm text-[#A8A29E] mix-blend-difference transition-colors duration-150"
    >
      <a href={href} title={title} className="block px-4 py-1.5">
        {children}
      </a>
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
