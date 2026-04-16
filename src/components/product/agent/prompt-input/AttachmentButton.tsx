// Part of OrangeBench product internal design system
"use client";

import { useRef } from "react";
import { Paperclip } from "lucide-react";

export function AttachmentButton() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="上传附件"
        className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-overlay hover:text-[#F5F5F4]"
      >
        <Paperclip size={16} />
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) console.log("[attach]", files.map((f) => f.name));
          e.target.value = "";
        }}
      />
    </>
  );
}
