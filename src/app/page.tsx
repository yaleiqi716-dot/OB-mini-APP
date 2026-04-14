import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

/**
 * Root route
 * - authenticated -> /agent
 * - unauthenticated -> /login
 *
 * /demo remains available as a legacy marketing page, but is no longer
 * used as the primary entry to avoid dual product-system confusion.
 */
export default function Home() {
  const jar = cookies();
  const hasSession = !!(jar.get('ob-session')?.value || jar.get('ob-user-id')?.value);
  redirect(hasSession ? '/agent' : '/login');
}
