"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   FAQ — adapted from 21st.dev (vaib215/faq-tabs)
   ────────────────────────────────────────────────────────────── */

const TAB_KEYS = ["general", "pricing_tab", "agents_tab", "security_tab"] as const;
const TAB_I18N_KEYS = ["general", "pricing", "agents", "security"] as const;

export default function FAQ() {
  const t = useTranslations("faq");
  const [selectedTab, setSelectedTab] = useState(0);

  // Build FAQ data from translations
  const tabs = TAB_KEYS.map((key, i) => ({
    key,
    label: t(`tabs.${TAB_I18N_KEYS[i]}`),
    items: (t.raw(key) as { q: string; a: string }[]),
  }));

  // JSON-LD from all tabs
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tabs.flatMap((tab) =>
      tab.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  };

  return (
    <section id="faq" className="relative overflow-hidden bg-[#0C0C0A] px-6 py-24 text-[#F5F5F4]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <span className="mb-8 bg-gradient-to-r from-[#FF5A1F] to-[#FF5A1F]/60 bg-clip-text font-medium text-transparent">
            {t("kicker")}
          </span>
          <h2 className="mb-8 text-center text-4xl font-bold md:text-5xl">
            {t("title")}
          </h2>
          <span className="absolute -top-[350px] left-[50%] z-0 h-[500px] w-[600px] -translate-x-[50%] rounded-full bg-gradient-to-r from-[#FF5A1F]/10 to-[#FF5A1F]/5 blur-3xl" />
        </div>

        {/* Tabs */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedTab(i)}
              className={cn(
                "relative overflow-hidden whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-500",
                selectedTab === i
                  ? "border-[#FF5A1F] text-[#F5F5F4]"
                  : "border-[#1F1F1D] bg-transparent text-[#A8A29E] hover:text-[#F5F5F4]"
              )}
            >
              <span className="relative z-10">{tab.label}</span>
              <AnimatePresence>
                {selectedTab === i && (
                  <motion.span
                    initial={{ y: "100%" }}
                    animate={{ y: "0%" }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.5, ease: "backIn" }}
                    className="absolute inset-0 z-0 bg-gradient-to-r from-[#FF5A1F] to-[#FF5A1F]/80"
                  />
                )}
              </AnimatePresence>
            </button>
          ))}
        </div>

        {/* FAQ list */}
        <div className="mx-auto mt-12 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={tabs[selectedTab].key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "backIn" }}
              className="space-y-4"
            >
              {tabs[selectedTab].items.map((faq, index) => (
                <FAQItem key={index} question={faq.q} answer={faq.a} index={index} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

let faqCounter = 0;

function FAQItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [ids] = useState(() => {
    const n = ++faqCounter;
    return { trigger: `faq-trigger-${n}`, panel: `faq-panel-${n}` };
  });

  return (
    <motion.div
      animate={isOpen ? "open" : "closed"}
      className={cn(
        "rounded-xl border transition-colors",
        isOpen
          ? "border-[#1F1F1D] bg-[#111110]"
          : "border-[#1F1F1D] bg-[#0C0C0A]"
      )}
    >
      <button
        id={ids.trigger}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={ids.panel}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <span
          className={cn(
            "text-lg font-medium transition-colors",
            isOpen ? "text-[#F5F5F4]" : "text-[#A8A29E]"
          )}
        >
          {question}
        </span>
        <motion.span
          variants={{
            open: { rotate: "45deg" },
            closed: { rotate: "0deg" },
          }}
          transition={{ duration: 0.2 }}
        >
          <Plus
            className={cn(
              "h-5 w-5 flex-shrink-0 transition-colors",
              isOpen ? "text-[#FF5A1F]" : "text-[#A8A29E]"
            )}
          />
        </motion.span>
      </button>
      <motion.div
        id={ids.panel}
        role="region"
        aria-labelledby={ids.trigger}
        initial={false}
        animate={{
          height: isOpen ? "auto" : "0px",
          marginBottom: isOpen ? "16px" : "0px",
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden px-4"
      >
        <p className="text-[#A8A29E]">{answer}</p>
      </motion.div>
    </motion.div>
  );
}
