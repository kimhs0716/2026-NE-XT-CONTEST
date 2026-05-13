"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SubjectAnalysis } from "@/lib/analytics/types";

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
      ? "-"
      : `${metrics.recentDelta > 0 ? "+" : ""}${metrics.recentDelta}%`;

  return (
    <Link
      href={`/analytics/${encodeURIComponent(metrics.subject)}`}
      className="block space-y-3 rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{metrics.subject}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", riskCfg.cls)}>
            {riskCfg.label}
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {PRIORITY_LABEL[strategy.priority] ?? ""}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="mb-0.5 text-[11px] text-muted-foreground">평균</p>
          <p className="text-base font-bold">{metrics.average}%</p>
        </div>
        <div>
          <p className="mb-0.5 text-[11px] text-muted-foreground">최근 점수</p>
          <p className="text-base font-bold">{metrics.latestScore}%</p>
        </div>
        <div>
          <p className="mb-0.5 text-[11px] text-muted-foreground">최근 변화</p>
          <p className={cn("text-base font-bold", deltaColor)}>{deltaStr}</p>
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {strategy.action}
      </div>
    </Link>
  );
}
