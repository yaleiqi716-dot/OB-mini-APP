import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[#1F1F1D] bg-[#0C0C0A] px-6 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
        {/* Brand */}
        <div className="flex flex-col items-center gap-2 md:items-start">
          <span className="text-lg font-bold text-[#F5F5F4]">OrangeBench</span>
          <span className="text-sm text-[#A8A29E]">
            AI-native workspace for teams that ship.
          </span>
        </div>

        {/* Links */}
        <div className="flex gap-12 text-sm">
          <div className="flex flex-col gap-2">
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
              Product
            </span>
            <Link href="#" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Features</Link>
            <Link href="#" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Pricing</Link>
            <Link href="#" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Docs</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
              Legal
            </span>
            <Link href="/privacy" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Privacy</Link>
            <Link href="/terms" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Terms</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="mb-1 text-xs font-medium uppercase tracking-widest text-[#A8A29E]">
              Social
            </span>
            <a href="https://twitter.com/orangebench" target="_blank" rel="noopener noreferrer" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">Twitter</a>
            <a href="https://github.com/orangebench" target="_blank" rel="noopener noreferrer" className="text-[#A8A29E] transition-colors duration-150 hover:text-[#F5F5F4]">GitHub</a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="mx-auto mt-8 max-w-5xl border-t border-[#1F1F1D] pt-6 text-center text-xs text-[#A8A29E]">
        &copy; {new Date().getFullYear()} OrangeBench. All rights reserved.
      </div>
    </footer>
  );
}
