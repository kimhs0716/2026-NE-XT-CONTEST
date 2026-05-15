"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubjectAnalysis } from "@/lib/analytics/types";
import { encodeSubjectSegment } from "@/lib/subject-route";

const RISK_CONFIG = {
  high: { label: "위험", cls: "bg-red-100 text-red-700" },
  medium: { label: "주의", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "안정", cls: "bg-green-100 text-green-700" },
  insufficient: { label: "데이터 부족", cls: "bg-gray-100 text-gray-500" },
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "1순위",
  2: "2순위",
  3: "유지",
};

export default function SubjectAnalysisCard({
  analysis,
}: {
  analysis: SubjectAnalysis;
}) {
  const { metrics, risk, strategy } = analysis;
  const riskCfg = RISK_CONFIG[risk.riskLevel];

  const deltaColor =
    metrics.recentDelta === null
      ? "text-muted-foreground"
      : metrics.recentDelta > 0
        ? "text-green-600"
        : metrics.recentDelta < 0
          ? "text-red-500"
          : "text-muted-foreground";

  const deltaStr =
    metrics.recentDelta === null
      ? "—"
      : `${metrics.recentDelta > 0 ? "+" : ""}${metrics.recentDelta}점`;

  return (
    <Link
      href={`/analytics/${encodeSubjectSegment(metrics.subject)}`}
      className="block rounded-xl border bg-white p-4 space-y-3 hover:shadow-sm transition-shadow"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{metrics.subject}</span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              riskCfg.cls,
            )}
          >
            {riskCfg.label}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          {PRIORITY_LABEL[strategy.priority] ?? ""}
        </span>
      </div>

      {/* 수치 3개 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground mb-0.5">평균</p>
          <p className="text-base font-bold">{metrics.average}점</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-0.5">최근 점수</p>
          <p className="text-base font-bold">{metrics.latestScore}점</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-0.5">최근 변화</p>
          <p className={cn("text-base font-bold", deltaColor)}>{deltaStr}</p>
        </div>
      </div>

      {/* 추천 전략 */}
      <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[11px] font-medium text-primary">학습 조언</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{strategy.action}</p>
      </div>
    </Link>
  );
}
