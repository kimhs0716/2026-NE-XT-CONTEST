"use client";

import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => logout()}>
      로그아웃
    </Button>
  );
}
