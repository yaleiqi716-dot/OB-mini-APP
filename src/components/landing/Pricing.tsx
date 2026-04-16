"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useTranslations } from "next-intl";

/* ──────────────────────────────────────────────────────────────
   Pricing — adapted from 21st.dev (ayushmxxn/pricing-section)
   ────────────────────────────────────────────────────────────── */

const DISCOUNT_RATE = 20;
const PLAN_KEYS = ["free", "pro", "team"] as const;
const PLAN_HREFS: Record<string, string> = { free: "/signup", pro: "/signup", team: "/contact" };

export default function Pricing() {
  const t = useTranslations("pricing");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");

  const getPrice = (price: number) => {
    if (price === 0) return "0";
    if (billingCycle === "annually") {
      return String(Math.round(price * 12 * (1 - DISCOUNT_RATE / 100)));
    }
    return String(price);
  };

  return (
    <section id="pricing" className="bg-[#0C0C0A] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-[#F5F5F4] md:text-5xl">
          {t("title")}
        </h2>
        <p className="text-base text-[#A8A29E]">{t("subtitle")}</p>
      </div>

      {/* Billing toggle */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex items-center rounded-lg border border-[#1F1F1D] bg-[#111110] p-1">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              billingCycle === "monthly"
                ? "bg-[#FF5A1F] text-[#F5F5F4]"
                : "text-[#A8A29E] hover:text-[#F5F5F4]"
            }`}
          >
            {t("monthly")}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annually")}
            className={`rounded-md px-5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              billingCycle === "annually"
                ? "bg-[#FF5A1F] text-[#F5F5F4]"
                : "text-[#A8A29E] hover:text-[#F5F5F4]"
            }`}
          >
            {t("annually")}
            <span className="ml-1.5 rounded-full bg-[#FF5A1F]/15 px-2 py-0.5 text-xs text-[#FF5A1F]">
              -{DISCOUNT_RATE}%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-stretch justify-center gap-6">
        {PLAN_KEYS.map((key) => {
          const popular = key === "pro";
          const price = Number(t(`${key}.price`));
          const features = t.raw(`${key}.features`) as string[];

          return (
            <div
              key={key}
              className={`flex w-full max-w-[320px] flex-col rounded-xl border p-6 transition-colors duration-150 ${
                popular
                  ? "border-[#FF5A1F] bg-[#111110] shadow-lg shadow-[#FF5A1F]/5"
                  : "border-[#1F1F1D] bg-[#111110]"
              }`}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-medium text-[#F5F5F4]">
                  {t(`${key}.name`)}
                </span>
                {popular && (
                  <span className="rounded-md bg-[#FF5A1F]/15 px-3 py-0.5 text-xs font-semibold text-[#FF5A1F]">
                    {t("pro.badge")}
                  </span>
                )}
              </div>

              <div className="mb-2">
                <span className="text-4xl font-bold text-[#F5F5F4]">
                  &yen;{getPrice(price)}
                </span>
                <span className="ml-1 text-sm text-[#A8A29E]">
                  {billingCycle === "annually" ? t("perYear") : t("perMonth")}
                </span>
              </div>
              <p className="mb-6 text-sm text-[#A8A29E]">{t(`${key}.description`)}</p>

              <Link
                href={PLAN_HREFS[key]}
                className={`mb-8 flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-150 ${
                  popular
                    ? "bg-[#FF5A1F] text-[#F5F5F4] hover:bg-[#FF6B35]"
                    : "border border-[#1F1F1D] bg-transparent text-[#F5F5F4] hover:bg-[#111110]"
                }`}
              >
                {t(`${key}.cta`)}
              </Link>

              <div className="mt-auto space-y-3">
                <span className="text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
                  {t("featuresLabel")}
                </span>
                {features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-sm text-[#A8A29E]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke={popular ? "#FF5A1F" : "currentColor"}
                      className="h-5 w-5 flex-shrink-0"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
                      />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
