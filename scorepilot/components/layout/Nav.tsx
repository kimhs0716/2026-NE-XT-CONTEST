import Link from "next/link";
import LogoutButton from "@/components/layout/LogoutButton";
import NavLinks from "@/components/layout/NavLinks";

export default function Nav() {
  return (
    <header className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-bold text-lg">
            Scorepilot
          </Link>
          <NavLinks />
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
