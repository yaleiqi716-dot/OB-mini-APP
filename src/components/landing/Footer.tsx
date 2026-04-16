"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-[#1F1F1D] bg-[#0C0C0A] px-6 py-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 md:items-start">
          <span className="text-lg font-bold text-[#F5F5F4]">OrangeBench</span>
          <span className="text-sm text-[#A8A29E]">{t("tagline")}</span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
              {t("product")}
            </span>
            <Link href="#" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">{t("features")}</Link>
            <Link href="#" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">{t("pricing")}</Link>
            <Link href="#" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">{t("docs")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
              {t("legal")}
            </span>
            <Link href="/privacy" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">{t("privacy")}</Link>
            <Link href="/terms" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">{t("terms")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
              {t("social")}
            </span>
            <a href="https://twitter.com/orangebench" target="_blank" rel="noopener noreferrer" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Twitter</a>
            <a href="https://github.com/orangebench" target="_blank" rel="noopener noreferrer" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">GitHub</a>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-7xl border-t border-[#1F1F1D] pt-6 text-center text-xs text-[#A8A29E]">
        {t("copyright")}
      </div>
    </footer>
  );
}
