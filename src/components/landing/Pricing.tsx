"use client";

import Link from "next/link";
import React, { useState } from "react";

/* ──────────────────────────────────────────────────────────────
   Pricing — adapted from 21st.dev (ayushmxxn/pricing-section)
   Original: light cards with billing toggle & SVG checkmarks.
   Customised: dark theme, OrangeBench plans, orange accent on
   Most Popular tier, brand copy.
   ────────────────────────────────────────────────────────────── */

interface Plan {
  name: string;
  monthlyPrice: number;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    description: "For individuals getting started.",
    features: [
      "100 agent tasks/mo",
      "1 workspace",
      "Community support",
    ],
    cta: "Get Started",
    href: "/signup",
  },
  {
    name: "Pro",
    monthlyPrice: 29,
    description: "For professionals who need more power.",
    features: [
      "Unlimited tasks",
      "5 workspaces",
      "Priority agents",
      "Email support",
    ],
    cta: "Upgrade",
    href: "/signup",
    popular: true,
  },
  {
    name: "Team",
    monthlyPrice: 99,
    description: "For teams that need full control.",
    features: [
      "Everything in Pro",
      "Unlimited workspaces",
      "SSO",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    href: "/contact",
  },
];

const DISCOUNT_RATE = 20;

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">(
    "monthly"
  );

  const getPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return 0;
    if (billingCycle === "annually") {
      return Math.round(monthlyPrice * 12 * (1 - DISCOUNT_RATE / 100));
    }
    return monthlyPrice;
  };

  return (
    <section className="bg-[#0C0C0A] px-6 py-24">
      {/* Header */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-[#F5F5F4] sm:text-5xl">
          Simple pricing that scales with you
        </h2>
        <p className="text-base text-[#A8A29E]">
          Start free, upgrade when you need to. No hidden fees.
        </p>
      </div>

      {/* Billing toggle (from original) */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-[#1F1F1D] bg-[#111110] p-1">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              billingCycle === "monthly"
                ? "bg-[#FF5A1F] text-white"
                : "text-[#A8A29E] hover:text-[#F5F5F4]"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annually")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              billingCycle === "annually"
                ? "bg-[#FF5A1F] text-white"
                : "text-[#A8A29E] hover:text-[#F5F5F4]"
            }`}
          >
            Annually
            <span className="ml-1.5 rounded-full bg-[#FF5A1F]/15 px-2 py-0.5 text-xs text-[#FF5A1F]">
              -{DISCOUNT_RATE}%
            </span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-stretch justify-center gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`flex w-80 flex-col rounded-2xl border p-6 transition-colors duration-150 ${
              plan.popular
                ? "border-[#FF5A1F] bg-[#111110] shadow-lg shadow-[#FF5A1F]/5"
                : "border-[#1F1F1D] bg-[#111110]"
            }`}
          >
            {/* Plan header */}
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-medium text-[#F5F5F4]">
                {plan.name}
              </span>
              {plan.popular && (
                <span className="rounded-full bg-[#FF5A1F]/15 px-3 py-0.5 text-xs font-semibold text-[#FF5A1F]">
                  Most Popular
                </span>
              )}
            </div>

            {/* Price */}
            <div className="mb-2">
              <span className="text-4xl font-bold text-[#F5F5F4]">
                ${getPrice(plan.monthlyPrice)}
              </span>
              <span className="ml-1 text-sm text-[#A8A29E]">
                {billingCycle === "annually" ? "/yr" : "/mo"}
              </span>
            </div>
            <p className="mb-6 text-sm text-[#A8A29E]">{plan.description}</p>

            {/* CTA */}
            <Link
              href={plan.href}
              className={`mb-8 flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-150 ${
                plan.popular
                  ? "bg-[#FF5A1F] text-white hover:bg-[#E84D15]"
                  : "border border-[#1F1F1D] bg-transparent text-[#F5F5F4] hover:border-[#FF5A1F]/30 hover:bg-[#1A1A18]"
              }`}
            >
              {plan.cta}
            </Link>

            {/* Features */}
            <div className="mt-auto space-y-3">
              <span className="text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
                Features
              </span>
              {plan.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-[#A8A29E]"
                >
                  {/* Checkmark (from original) */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke={plan.popular ? "#FF5A1F" : "currentColor"}
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
        ))}
      </div>
    </section>
  );
}
