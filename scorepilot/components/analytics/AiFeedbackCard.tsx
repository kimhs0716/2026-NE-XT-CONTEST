"use client";

import { useState, useTransition } from "react";
import { generateAiFeedback } from "@/lib/actions/ai-feedback";
import { Sparkles } from "lucide-react";

type FeedbackState = {
  text: string;
  source: "llm" | "fallback";
  isQuotaError: boolean;
};

export default function AiFeedbackCard() {
  const [result, setResult] = useState<FeedbackState | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setDataError(null);
    startTransition(async () => {
      const res = await generateAiFeedback();
      if (res.error) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">AI 학습 피드백</h2>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "생성 중..." : result ? "새로고침" : "피드백 생성"}
        </button>
      </div>

      {!result && !dataError && !isPending && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p>버튼을 눌러 맞춤 피드백을 받아보세요.</p>
          <p className="mt-1 text-xs">
            자체 분석 결과를 바탕으로 학습 코멘트를 작성합니다.
          </p>
        </div>
      )}

      {isPending && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <div className="mb-2 animate-pulse text-2xl text-primary">...</div>
          <p>피드백 생성 중...</p>
        </div>
      )}

      {dataError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dataError}
        </div>
      )}

      {result && !isPending && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {result.source === "llm" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" /> AI 피드백
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                기본 피드백
              </span>
            )}
            {result.isQuotaError && (
              <span className="text-xs text-muted-foreground">
                AI 생성 한도 초과로 기본 피드백을 표시 중
              </span>
            )}
          </div>

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {result.text}
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        * 예측 점수와 위험도는 자체 모델로 계산하며, AI는 문장 생성 보조 역할을 합니다.
      </p>
    </div>
  );
}
