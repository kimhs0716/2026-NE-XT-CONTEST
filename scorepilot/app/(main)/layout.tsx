import Nav from "@/components/layout/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let schoolLevel: "middle" | "high" | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("school_level")
      .eq("id", user.id)
      .single();
    schoolLevel = (data?.school_level as "middle" | "high") ?? null;
  }

  return (
    <>
      <Nav schoolLevel={schoolLevel} />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </>
  );
}
