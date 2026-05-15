"use client";

import { useActionState, useState, startTransition, useTransition } from "react";
import Link from "next/link";
import { login, resetSession } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  const [resetPending, startResetTransition] = useTransition();
  const [resetDone, setResetDone] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">로그인</CardTitle>
        <CardDescription>Scorepilot에 오신 것을 환영합니다</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일<span className="text-red-500">*</span></Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호<span className="text-red-500">*</span></Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "로그인 중..." : "로그인"}
          </Button>
        </form>
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={resetPending}
            onClick={() => {
              startResetTransition(async () => {
                await resetSession();
                setPassword("");
                setResetDone(true);
              });
            }}
          >
            {resetPending ? "초기화 중..." : "세션 초기화"}
          </Button>
          {resetDone && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              세션을 초기화했습니다. 다시 로그인해주세요.
            </p>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
