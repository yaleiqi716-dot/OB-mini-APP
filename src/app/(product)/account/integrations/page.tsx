'use client';

// /account/integrations → REDIRECT to /account/skills (Skills Hub)
// Original webhook management merged into the unified Skills Hub.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/account/skills'); }, [router]);
  return null;
}
