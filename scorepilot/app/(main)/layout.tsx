import Nav from "@/components/layout/Nav";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className="px-4 py-8">{children}</main>
    </>
  );
}
