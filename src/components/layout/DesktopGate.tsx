"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ob-desktop-gate-dismissed";
const MIN_WIDTH = 1024;

export default function DesktopGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    if (!dismissed && window.innerWidth < MIN_WIDTH) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0C0C0A] px-6 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-[#FF5A1F]/10">
        <svg
          className="h-8 w-8 text-[#FF5A1F]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
          />
        </svg>
      </div>

      <h1 className="mb-3 text-2xl font-bold text-[#F5F5F4]">
        OrangeBench is designed for desktop
      </h1>
      <p className="mb-8 max-w-md text-base text-[#A8A29E]">
        Please access this page from a computer for the best experience.
      </p>

      <button
        type="button"
        onClick={dismiss}
        className="rounded-lg border border-[#1F1F1D] bg-transparent px-6 py-3 text-sm font-medium text-[#F5F5F4] transition-all duration-150 hover:bg-[#111110]"
      >
        Continue anyway
      </button>
    </div>
  );
}
