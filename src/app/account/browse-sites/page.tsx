'use client';

// /account/browse-sites → REDIRECT to /account/skills (Skills Hub)
// Original browse credential management merged into the unified Skills Hub.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BrowseSitesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/account/skills'); }, [router]);
  return null;
}
