import Nav from "@/components/layout/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userName: string | null = null;
  let schoolLevel: "middle" | "high" | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("name, school_level")
      .eq("id", user.id)
      .single();
    userName = data?.name ?? null;
    schoolLevel = (data?.school_level as "middle" | "high") ?? null;
  }

  return (
    <>
      <Nav userName={userName} schoolLevel={schoolLevel} />
      <main className="py-8">{children}</main>
    </>
  );
}
