import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">Scorepilot</h1>
          <p className="text-xl text-muted-foreground">
            AI 기반 학업 관리 시스템
          </p>
        </div>

        <div className="space-y-3 text-gray-600 text-base leading-relaxed">
          <p>성적이 오르거나 내려가도 그 원인을 정확히 파악하기 어려우셨나요?</p>
          <p>
            Scorepilot은 학생의 성적 데이터를 바탕으로{" "}
            <strong>성적 변화 원인을 분석</strong>하고,{" "}
            <strong>다음 시험을 예측</strong>하며,{" "}
            <strong>맞춤 학습 전략</strong>을 제시합니다.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold text-sm">성적 분석</div>
            <div className="text-xs text-muted-foreground mt-1">강점·약점 자동 감지</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-semibold text-sm">AI 예측</div>
            <div className="text-xs text-muted-foreground mt-1">다음 시험 점수 예측</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl mb-2">📅</div>
            <div className="font-semibold text-sm">학업 캘린더</div>
            <div className="text-xs text-muted-foreground mt-1">시험·과제 일정 관리</div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <Link href="/signup">
            <Button size="lg" className="px-8">시작하기</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="px-8">로그인</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
