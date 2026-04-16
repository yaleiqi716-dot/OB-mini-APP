import DesktopGate from "@/components/layout/DesktopGate";

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DesktopGate />
      {children}
    </>
  );
}
