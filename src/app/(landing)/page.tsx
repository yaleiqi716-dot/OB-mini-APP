import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LandingContent from "./LandingContent";

/**
 * Root route — landing page for visitors, redirect for logged-in users.
 *
 *   authenticated   → /agent  (workspace home)
 *   unauthenticated → render landing page
 */
export default function LandingPage() {
  const jar = cookies();
  const hasSession = !!(
    jar.get("ob-session")?.value || jar.get("ob-user-id")?.value
  );

  if (hasSession) {
    redirect("/agent");
  }

  return <LandingContent />;
}
