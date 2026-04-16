"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   FAQ — adapted from 21st.dev (vaib215/faq-tabs)
   Original: tabbed FAQ with animated tab fill, accordion items,
   and framer-motion transitions.
   Customised: dark theme, orange accent tabs, OrangeBench Q&A
   across four categories.
   ────────────────────────────────────────────────────────────── */

const CATEGORIES: Record<string, string> = {
  general: "General",
  pricing: "Pricing",
  agents: "Agents",
  security: "Security",
};

const FAQ_DATA: Record<string, { question: string; answer: string }[]> = {
  general: [
    {
      question: "What is OrangeBench?",
      answer:
        "OrangeBench is an AI-native workspace that combines agents, task management, and team collaboration.",
    },
    {
      question: "Who is it for?",
      answer:
        "Small teams and indie builders who want to replace multiple tools with one unified workflow.",
    },
    {
      question: "How is it different from Notion or Monday?",
      answer:
        "OrangeBench is built agent-first. AI executes tasks, not just stores them.",
    },
  ],
  pricing: [
    {
      question: "Is there a free plan?",
      answer: "Yes, Free tier includes 100 agent tasks per month.",
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes, monthly plans cancel anytime with no fees.",
    },
    {
      question: "Do you offer annual discounts?",
      answer: "Annual plans get 20% off.",
    },
  ],
  agents: [
    {
      question: "What can agents do?",
      answer:
        "Research, summarize, execute multi-step tasks, browse the web, and more.",
    },
    {
      question: "How are agent tasks counted?",
      answer:
        "One task equals one agent execution from start to finish.",
    },
    {
      question: "Can I bring my own API keys?",
      answer: "Yes, Pro and Team plans support BYOK.",
    },
  ],
  security: [
    {
      question: "Where is my data stored?",
      answer:
        "Encrypted at rest in AWS, SOC 2 compliant infrastructure.",
    },
    {
      question: "Do you train on my data?",
      answer: "No, your data is never used for model training.",
    },
    {
      question: "Is there SSO?",
      answer:
        "Team plan includes SSO via Google, Microsoft, and Okta.",
    },
  ],
};

export default function FAQ() {
  const categoryKeys = Object.keys(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState(categoryKeys[0]);

  return (
    <section className="relative overflow-hidden bg-[#0C0C0A] px-6 py-24 text-[#F5F5F4]">
      <div className="mx-auto max-w-7xl">
        <FAQHeader />
        <FAQTabs
          selected={selectedCategory}
          setSelected={setSelectedCategory}
        />
        <FAQList selected={selectedCategory} />
      </div>
    </section>
  );
}

/* ── Header (from original) ──────────────────────────────────── */

function FAQHeader() {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center">
      <span className="mb-8 bg-gradient-to-r from-[#FF5A1F] to-[#FF5A1F]/60 bg-clip-text font-medium text-transparent">
        Got questions?
      </span>
      <h2 className="mb-8 text-center text-4xl font-bold md:text-5xl">
        Frequently asked questions
      </h2>
      <span className="absolute -top-[350px] left-[50%] z-0 h-[500px] w-[600px] -translate-x-[50%] rounded-full bg-gradient-to-r from-[#FF5A1F]/10 to-[#FF5A1F]/5 blur-3xl" />
    </div>
  );
}

/* ── Tabs (from original) ────────────────────────────────────── */

function FAQTabs({
  selected,
  setSelected,
}: {
  selected: string;
  setSelected: (v: string) => void;
}) {
  return (
    <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
      {Object.entries(CATEGORIES).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setSelected(key)}
          className={cn(
            "relative overflow-hidden whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-500",
            selected === key
              ? "border-[#FF5A1F] text-[#F5F5F4]"
              : "border-[#1F1F1D] bg-transparent text-[#A8A29E] hover:text-[#F5F5F4]"
          )}
        >
          <span className="relative z-10">{label}</span>
          <AnimatePresence>
            {selected === key && (
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
  );
}

/* ── FAQ list (from original) ────────────────────────────────── */

function FAQList({ selected }: { selected: string }) {
  return (
    <div className="mx-auto mt-12 max-w-3xl">
      <AnimatePresence mode="wait">
        {Object.entries(FAQ_DATA).map(([category, questions]) => {
          if (selected !== category) return null;
          return (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "backIn" }}
              className="space-y-4"
            >
              {questions.map((faq, index) => (
                <FAQItem key={index} {...faq} />
              ))}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ── Accordion item (from original) ──────────────────────────── */

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

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
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
