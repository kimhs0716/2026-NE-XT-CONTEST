import Link from "next/link";
import Image from "next/image";
import LogoutButton from "@/components/layout/LogoutButton";
import NavLinks from "@/components/layout/NavLinks";

export default function Nav({
  userName,
  schoolLevel,
}: {
  userName: string | null;
  schoolLevel: "middle" | "high" | null;
}) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="h-14 px-8 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Scorepilot" width={28} height={28} className="rounded-sm" />
            <span className="font-bold text-lg tracking-tight">Scorepilot</span>
          </Link>
          <NavLinks schoolLevel={schoolLevel} />
        </div>
        <div className="flex items-center gap-3">
          {userName && (
            <span className="text-sm text-muted-foreground font-medium">
              {userName}
            </span>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
