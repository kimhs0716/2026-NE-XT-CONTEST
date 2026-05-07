"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/grades", label: "성적 관리" },
  { href: "/analytics", label: "성적 분석" },
  { href: "/calendar", label: "캘린더" },
];

export default function NavLinks() {
  const pathname = usePathname();
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
