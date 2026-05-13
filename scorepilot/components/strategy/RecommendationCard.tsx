"use client";

import { useState, useTransition } from "react";
import { convertRecommendationToTask } from "@/lib/actions/recommendations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecommendationCardValue = {
  id: string;
  title: string;
  description: string;
  priority: string | null;
  recommendationType: string | null;
  subject: string;
  weaknessTitle: string | null;
};

const priorityLabel: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const recommendationTypeLabel: Record<string, string> = {
  practice: "문제 풀이",
  schedule: "시간 확보",
  review: "복습",
  strategy: "전략 조정",
};

const subjectPalette = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

function subjectBadgeClass(subject: string): string {
  const hash = [...subject].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return subjectPalette[hash % subjectPalette.length];
}

export default function RecommendationCard({ recommendation }: { recommendation: RecommendationCardValue }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [converted, setConverted] = useState(false);

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">{recommendation.title}</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {recommendation.description}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white border px-2 py-0.5 text-[11px] text-muted-foreground">
          {priorityLabel[recommendation.priority ?? ""] ?? recommendation.priority ?? "보통"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className={cn("rounded-full px-2 py-0.5 font-medium", subjectBadgeClass(recommendation.subject))}>
          {recommendation.subject}
        </span>
        {recommendation.recommendationType && (
          <span className="rounded-full bg-white border px-2 py-0.5">
            {recommendationTypeLabel[recommendation.recommendationType] ?? recommendation.recommendationType}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending || converted}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await convertRecommendationToTask(recommendation.id);
              if (result?.error) {
                setMessage(result.error);
                return;
              }
              setConverted(true);
              setMessage("할 일에 추가됨");
            });
          }}
        >
          {isPending ? "추가 중..." : converted ? "추가됨" : "할 일로 추가"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
