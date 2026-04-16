"use client";

import { useState } from "react";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);

  async function uploadFiles(
    files: File[]
  ): Promise<{ uploaded: UploadedFile[]; errors: string[] }> {
    const uploaded: UploadedFile[] = [];
    const errors: string[] = [];
    setUploading(true);

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        errors.push(`${file.name} 超出 10MB 限制`);
        continue;
      }
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          errors.push(d.error || `${file.name} 上传失败`);
          continue;
        }
        const data = await res.json();
        if (data.success && data.file) {
          uploaded.push(data.file);
        } else {
          errors.push(`${file.name} 上传失败`);
        }
      } catch {
        errors.push(`${file.name} 网络错误`);
      }
    }

    setUploading(false);
    return { uploaded, errors };
  }

  return { uploadFiles, uploading };
}
