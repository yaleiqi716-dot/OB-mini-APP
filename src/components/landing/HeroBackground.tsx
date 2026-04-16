"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

/* ──────────────────────────────────────────────────────────────
   HeroBackground — adapted from 21st.dev (kokonutd/background-paths)
   Original: animated SVG path background with letter-by-letter
   title entrance.  Customised with OrangeBench branding, orange
   path strokes, dual CTA buttons, subtitle, and dark bg.
   ────────────────────────────────────────────────────────────── */

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="#FF5A1F"
            strokeWidth={path.width}
            strokeOpacity={0.05 + path.id * 0.015}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export default function HeroBackground() {
  const t = useTranslations("hero");
  const titleWords = t("title").split(/\s+/);
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0C0C0A] pt-20 md:pt-24">
      {/* Animated SVG path layers */}
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
        >
          {/* Title — letter-by-letter spring entrance (from original) */}
          <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
            {titleWords.map((word, wordIndex) => (
              <span
                key={wordIndex}
                className="mr-4 inline-block last:mr-0"
              >
                {word.split("").map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.03,
                      type: "spring",
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block text-[#F5F5F4]"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-[#A8A29E]"
          >
            {t("subtitle")}
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}
            className="mt-8 flex items-center justify-center gap-4"
          >
            {/* Primary — Start for Free */}
            <Link
              href="/signup"
              className="group inline-flex items-center rounded-lg bg-[#FF5A1F] px-8 py-3 text-base font-semibold text-white transition-all duration-150 hover:bg-[#FF6B35] hover:shadow-lg hover:shadow-[#FF5A1F]/20"
            >
              {t("cta_primary")}
              <ArrowRight size={18} className="ml-2 transition-transform duration-150 group-hover:translate-x-1" />
            </Link>

            {/* Secondary — Watch Demo */}
            <Link
              href="#"
              className="inline-flex items-center rounded-lg border border-[#1F1F1D] bg-transparent px-8 py-3 text-base font-semibold text-[#F5F5F4] transition-all duration-150 hover:bg-[#111110]"
            >
              {t("cta_secondary")}
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
