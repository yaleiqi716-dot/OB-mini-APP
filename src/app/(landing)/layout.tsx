export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0C0C0A] text-[#F5F5F4]">
      {children}
    </main>
  );
}
