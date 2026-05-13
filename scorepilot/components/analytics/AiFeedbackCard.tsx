"use client";

import { useState, useTransition } from "react";
import { generateAiFeedback } from "@/lib/actions/ai-feedback";
import { Sparkles } from "lucide-react";

type FeedbackState = {
  text: string;
  source: "llm" | "fallback";
  isQuotaError: boolean;
};

export default function AiFeedbackCard({
  initialFeedback,
}: {
  initialFeedback?: { text: string; createdAt: string } | null;
}) {
  const [result, setResult] = useState<FeedbackState | null>(
    initialFeedback
      ? { text: initialFeedback.text, source: "llm", isQuotaError: false }
      : null,
  );
  const [dataError, setDataError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setDataError(null);
    startTransition(async () => {
      const res = await generateAiFeedback();
      if (res.error) {
        // 데이터 없음 등 진짜 오류만 에러로 표시
        setDataError(res.error);
      } else if (res.feedback) {
        setResult({
          text: res.feedback,
          source: res.source ?? "fallback",
          isQuotaError: res.isQuotaError ?? false,
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">AI 맞춤 피드백</h2>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "생성 중…" : result ? "AI 맞춤 피드백 다시 생성" : "AI 맞춤 피드백 생성"}
        </button>
      </div>

      {/* 초기 상태 */}
      {!result && !dataError && !isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>성적과 공부 기록을 바탕으로 오늘의 학습 방향을 정리합니다.</p>
        </div>
      )}

      {/* 로딩 */}
      {isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <div className="animate-pulse text-primary text-2xl mb-2">✦</div>
          <p>피드백을 정리하는 중입니다.</p>
        </div>
      )}

      {/* 데이터 오류 (성적 없음 등) */}
      {dataError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {dataError}
        </div>
      )}

      {/* 피드백 결과 */}
      {result && !isPending && (
        <div className="space-y-3">
          {/* 최근 생성 배지 */}
          {initialFeedback && result.text === initialFeedback.text && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              최근 생성됨
            </span>
          )}

          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {result.text}
          </p>
        </div>
      )}
    </div>
  );
}
