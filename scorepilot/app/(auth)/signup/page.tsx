"use client";

import { useActionState, useState, startTransition } from "react";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const schoolLevelLabels: Record<string, string> = {
  middle: "중학교",
  high: "고등학교",
};

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, null);
  const [name, setName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (state?.needsConfirmation) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">이메일을 확인해주세요</CardTitle>
          <CardDescription>
            입력하신 이메일로 인증 링크를 발송했습니다.
            <br />
            이메일 인증 후 로그인해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">로그인 페이지로</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>학업 관리를 시작해보세요</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_level">학교 구분</Label>
            <Select
              name="school_level"
              value={schoolLevel}
              onValueChange={(v) => setSchoolLevel(v ?? "")}
            >
              <SelectTrigger id="school_level" className="w-full">
                {schoolLevel ? (
                  <span>{schoolLevelLabels[schoolLevel]}</span>
                ) : (
                  <span className="text-muted-foreground">선택해주세요</span>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="middle" label="중학교">중학교</SelectItem>
                <SelectItem value="high" label="고등학교">고등학교</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              placeholder="6자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "가입 중..." : "회원가입"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-primary hover:underline">
            로그인
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
