'use client';

// /account/ai-tools → REDIRECT to /account/skills (Skills Hub)
// Original MCP management UI merged into the unified Skills Hub.
// This file remains so old bookmarks/links still work.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AiToolsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/account/skills'); }, [router]);
  return null;
}
