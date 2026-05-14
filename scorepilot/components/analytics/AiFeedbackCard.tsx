"use client";

import { useState, useTransition } from "react";
import { generateAiFeedback } from "@/lib/actions/ai-feedback";
import { Sparkles, Target, CheckCircle, Heart } from "lucide-react";

type FeedbackState = {
  text: string;
  source: "llm" | "fallback";
  isQuotaError: boolean;
};

type ParsedSections = {
  focus: string | null;
  check: string | null;
  encourage: string | null;
};

function parseSections(text: string): ParsedSections {
  const focusMatch = text.match(/\[집중\]\s*([\s\S]+?)(?=\s*\[(?:점검|응원)\]|$)/);
  const checkMatch = text.match(/\[점검\]\s*([\s\S]+?)(?=\s*\[응원\]|$)/);
  const encourageMatch = text.match(/\[응원\]\s*([\s\S]+?)$/);
  return {
    focus: focusMatch?.[1]?.trim() ?? null,
    check: checkMatch?.[1]?.trim() ?? null,
    encourage: encourageMatch?.[1]?.trim() ?? null,
  };
}

const SECTION_CONFIG = [
  {
    key: "focus" as const,
    label: "집중",
    icon: Target,
    color: "text-red-500",
    bg: "bg-red-50 border-red-100",
  },
  {
    key: "check" as const,
    label: "점검",
    icon: CheckCircle,
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-100",
  },
  {
    key: "encourage" as const,
    label: "응원",
    icon: Heart,
    color: "text-pink-500",
    bg: "bg-pink-50 border-pink-100",
  },
];

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

  const sections = result ? parseSections(result.text) : null;
  const isStructured =
    sections && (sections.focus || sections.check || sections.encourage);

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
          {isPending ? "생성 중…" : result ? "다시 생성" : "AI 맞춤 피드백 생성"}
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

      {/* 데이터 오류 */}
      {dataError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {dataError}
        </div>
      )}

      {/* 피드백 결과 */}
      {result && !isPending && (
        <div className="space-y-2.5">
          {initialFeedback && result.text === initialFeedback.text && (
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium mb-1">
              최근 생성됨
            </span>
          )}

          {isStructured ? (
            SECTION_CONFIG.map(({ key, label, icon: Icon, color, bg }) => {
              const content = sections[key];
              if (!content) return null;
              return (
                <div
                  key={key}
                  className={`flex gap-3 rounded-lg border px-3.5 py-3 ${bg}`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                  <div>
                    <span className={`text-xs font-semibold mr-1.5 ${color}`}>
                      {label}
                    </span>
                    <span className="text-sm text-foreground leading-relaxed">
                      {content}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {result.text}
            </p>
          )}

          {result.isQuotaError && (
            <p className="text-xs text-muted-foreground pt-1">
              API 한도를 초과하여 기본 피드백이 제공되었습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
