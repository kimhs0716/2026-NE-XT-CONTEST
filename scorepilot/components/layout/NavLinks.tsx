"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const baseNavItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/grades", label: "내신" },
  { href: "/analytics", label: "분석" },
  { href: "/strategy", label: "맞춤전략" },
  { href: "/calendar", label: "캘린더" },
];

const highSchoolNavItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/grades", label: "내신" },
  { href: "/mock-exam", label: "모의고사" },
  { href: "/analytics", label: "분석" },
  { href: "/strategy", label: "맞춤전략" },
  { href: "/calendar", label: "캘린더" },
];

export default function NavLinks({ schoolLevel }: { schoolLevel: "middle" | "high" | null }) {
  const pathname = usePathname();
  const navItems = schoolLevel === "high" ? highSchoolNavItems : baseNavItems;

  return (
    <nav className="flex gap-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`text-sm transition-colors ${
            pathname === item.href || pathname.startsWith(item.href + "/")
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
