import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

/**
 * Root route — smart routing based on auth state.
 *
 * Previously redirected blindly to /agent, which for unauthenticated
 * visitors meant `/ → /agent → middleware → /login?redirect=/agent`
 * — a 2-hop chain through a page they can never see with zero
 * product comprehension at the end.
 *
 * Now:
 *   authenticated user    → /agent   (their home base)
 *   unauthenticated user  → /demo    (see the product before signup)
 *
 * This is a Server Component so cookies() works and the redirect is
 * a real 307 at the edge, not a client bounce.
 */
export default function Home() {
  const jar = cookies();
  const hasSession = !!(jar.get('ob-session')?.value || jar.get('ob-user-id')?.value);
  redirect(hasSession ? '/agent' : '/demo');
}
