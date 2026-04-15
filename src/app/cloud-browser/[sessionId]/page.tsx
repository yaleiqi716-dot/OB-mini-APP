import { CloudBrowserShell } from '@/components/cloud-browser/CloudBrowserShell';

export default function CloudBrowserSessionPage({ params }: { params: { sessionId: string } }) {
  return <CloudBrowserShell sessionId={params.sessionId} mode="session" />;
}
