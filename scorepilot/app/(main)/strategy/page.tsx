import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { computeStrategy } from "@/lib/analytics/strategy";
import { computePrediction } from "@/lib/analytics/prediction";
import type { GradePoint, RiskLevel } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

type ExamRow = {
  subjects: { name: string } | { name: string }[] | null;
  semesters:
    | { year: number; semester_type: string }
    | { year: number; semester_type: string }[]
    | null;
  grade_records: { percentage: number }[];
};

type StrategyInsight = {
  subject: string;
  average: number;
  latestScore: number;
  recentDelta: number | null;
  volatility: number;
  count: number;
  riskLevel: RiskLevel;
  riskReason: string;
  priority: number;
  recommendedAction: string;
  predictedScore: number | null;
  confidence: number | null;
  basis: string | null;
  latestSemester: string;
  trend: string;
};

const riskConfig: Record<RiskLevel, { label: string; cls: string }> = {
  high: { label: "즉시 보강", cls: "bg-red-100 text-red-700" },
  medium: { label: "유지 필요", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "안정", cls: "bg-green-100 text-green-700" },
  insufficient: { label: "데이터 부족", cls: "bg-gray-100 text-gray-600" },
};

const trendConfig: Record<string, { icon: string; cls: string; label: string }> = {
  up: { icon: "↑", cls: "text-green-600", label: "상승" },
  down: { icon: "↓", cls: "text-red-500", label: "하락" },
  stable: { icon: "→", cls: "text-muted-foreground", label: "유지" },
  new: { icon: "•", cls: "text-muted-foreground", label: "신규" },
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

function formatDelta(delta: number | null): string {
  if (delta === null) return "-";
  return `${delta > 0 ? "+" : ""}${delta}점`;
}

function summarizeSubjects(subjects: StrategyInsight[]): string {
  return subjects.map((subject) => subject.subject).join(", ");
}

function semOrderOf(year: number, type: SemesterType): number {
  return year * 10 + (type === "semester_2" ? 2 : 1);
}

function computeStrategyInsights(rows: ExamRow[]): StrategyInsight[] {
  const map = new Map<
    string,
    { grades: GradePoint[]; latestSemester: string; latestSemOrder: number }
  >();

  for (const r of rows) {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) continue;
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) continue;
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) continue;
    const semType = sem.semester_type as SemesterType;
    const semOrder = semOrderOf(sem.year, semType);

    if (!map.has(name)) {
      map.set(name, { grades: [], latestSemester: formatSemester(sem.year, semType), latestSemOrder: semOrder });
    }

    const entry = map.get(name)!;
    entry.grades.push({ percentage: Number(pct), semOrder });
    if (semOrder >= entry.latestSemOrder) {
      entry.latestSemester = formatSemester(sem.year, semType);
      entry.latestSemOrder = semOrder;
    }
  }

  return [...map.entries()]
    .map(([subject, data]) => {
      const metrics = computeMetrics(subject, data.grades);
      const risk = computeRisk(metrics);
      const strategy = computeStrategy(metrics, risk);
      const prediction = computePrediction(data.grades);

      return {
        subject,
        average: metrics.average,
        latestScore: metrics.latestScore,
        recentDelta: metrics.recentDelta,
        volatility: metrics.volatility,
        count: metrics.count,
        riskLevel: risk.riskLevel,
        riskReason: risk.reasons[0] ?? "",
        priority: strategy.priority,
        recommendedAction: strategy.action,
        predictedScore: prediction?.predictedScore ?? null,
        confidence: prediction?.confidence ?? null,
        basis: prediction?.basis ?? null,
        latestSemester: data.latestSemester,
        trend: metrics.trend,
      };
    })
    .sort((a, b) => a.priority - b.priority || a.average - b.average || a.subject.localeCompare(b.subject, "ko"));
}

export default async function StrategyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows }, { data: profileData }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        subjects ( name ),
        semesters!exam_semester ( year, semester_type ),
        grade_records ( percentage )
      `)
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("school_level, name")
      .eq("id", user.id)
      .single(),
  ]);

  const schoolLevel = (profileData?.school_level as "middle" | "high" | null) ?? null;
  const userName = profileData?.name ?? null;

  const insights = computeStrategyInsights((rows ?? []) as ExamRow[]);
  const weak = insights.filter((s) => s.riskLevel === "high");
  const caution = insights.filter((s) => s.riskLevel === "medium");
  const strong = insights.filter((s) => s.riskLevel === "low");
  const lowData = insights.filter((s) => s.riskLevel === "insufficient");

  const totalSubjects = insights.length;
  const overallAvg =
    totalSubjects > 0
      ? Math.round((insights.reduce((sum, item) => sum + item.average, 0) / totalSubjects) * 10) / 10
      : null;

  const topPriority = insights[0] ?? null;
  const nextFocus = weak[0] ?? caution[0] ?? insights[0] ?? null;
  const actionCount = weak.length + caution.length + strong.length + lowData.length;

  const weeklyPlan = [
    {
      title: "오늘 30분 집중",
      description: nextFocus
        ? `${nextFocus.subject}의 ${nextFocus.riskReason || "핵심 개념"}을 기준으로 오답/개념을 먼저 정리하세요.`
        : "가장 흔들리는 과목부터 30분만 집중 정리하세요.",
    },
    {
      title: "이번 주 3회 복습",
      description: caution.length > 0
        ? `${summarizeSubjects(caution.slice(0, 2))} 과목은 짧게 자주 복습해 평균을 끌어올리세요.`
        : "중간권 과목이 생기면 주 3회 복습 루틴을 바로 붙이세요.",
    },
    {
      title: "강점 유지 점검",
      description: strong.length > 0
        ? `${summarizeSubjects(strong.slice(0, 2))} 과목은 유지 학습만으로도 점수를 지킬 수 있습니다.`
        : "강점 과목은 시험 직전 1회 점검 중심으로 유지하세요.",
    },
  ];

  const decisionRules = [
    {
      label: "즉시 보강",
      detail: "평균 60점 미만 또는 최근 하락 폭이 큰 과목",
      count: weak.length,
    },
    {
      label: "꾸준히 유지",
      detail: "60~79점 구간의 과목",
      count: caution.length,
    },
    {
      label: "강점 유지",
      detail: "80점 이상 과목",
      count: strong.length,
    },
  ];

  const schoolLevelLabel = schoolLevel === "high" ? "고등학생 기준: 내신 + 모의고사" : "중학생 기준: 내신 중심";

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">맞춤전략</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {userName ? `${userName}님, ` : ""}{schoolLevelLabel}에 맞춰 지금 당장 실행할 순서로 정리한 학습 전략입니다.
        </p>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center text-muted-foreground text-sm">
          성적을 등록하면 과목별 우선순위, 실행 계획, 판단 근거가 자동으로 생성됩니다.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.95fr] items-start">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border bg-white p-5">
                <p className="text-xs text-muted-foreground mb-1">전체 평균</p>
                <p className="text-2xl font-bold">{overallAvg != null ? `${overallAvg}%` : "-"}</p>
                <p className="text-xs text-muted-foreground mt-2">분석된 과목 {totalSubjects}개</p>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <p className="text-xs text-muted-foreground mb-1">즉시 보강</p>
                <p className="text-2xl font-bold text-red-600">{weak.length}</p>
                <p className="text-xs text-muted-foreground mt-2">평균 60점 미만 / 급락 과목</p>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <p className="text-xs text-muted-foreground mb-1">유지 필요</p>
                <p className="text-2xl font-bold text-yellow-600">{caution.length}</p>
                <p className="text-xs text-muted-foreground mt-2">70점대 구간의 관리 대상</p>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <p className="text-xs text-muted-foreground mb-1">강점 유지</p>
                <p className="text-2xl font-bold text-green-600">{strong.length}</p>
                <p className="text-xs text-muted-foreground mt-2">시험 직전 점검으로 유지</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold">과목별 우선순위</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    평균과 최근 흐름을 함께 반영한 실행 순서입니다.
                  </p>
                </div>
                {topPriority && (
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", riskConfig[topPriority.riskLevel].cls)}>
                    지금 가장 먼저 볼 과목: {topPriority.subject}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {insights.map((item) => {
                  const trend = trendConfig[item.trend] ?? trendConfig.new;
                  return (
                    <div key={item.subject} className="rounded-xl border p-4 bg-muted/20">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", subjectBadgeClass(item.subject))}>
                              {item.subject}
                            </span>
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", riskConfig[item.riskLevel].cls)}>
                              {riskConfig[item.riskLevel].label}
                            </span>
                            <span className={cn("text-xs font-semibold", trend.cls)}>
                              {trend.icon} {trend.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{item.recommendedAction}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.latestSemester} 기준 · 최근 변화 {formatDelta(item.recentDelta)} · 기록 {item.count}회 · 변동성 {item.volatility}점
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center shrink-0">
                          <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                            <p className="text-[10px] text-muted-foreground">평균</p>
                            <p className="font-bold">{item.average}%</p>
                          </div>
                          <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                            <p className="text-[10px] text-muted-foreground">최근 점수</p>
                            <p className="font-bold">{item.latestScore}%</p>
                          </div>
                          <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                            <p className="text-[10px] text-muted-foreground">예측</p>
                            <p className="font-bold">{item.predictedScore != null ? `${item.predictedScore}%` : "-"}</p>
                          </div>
                        </div>
                      </div>
                      {(item.basis || item.riskReason) && (
                        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-muted-foreground border">
                          {item.riskReason || "분석 근거 없음"}{item.basis ? ` · ${item.basis}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {decisionRules.map((rule) => (
                <div key={rule.label} className="rounded-2xl border bg-white p-5">
                  <p className="text-xs text-muted-foreground">{rule.label}</p>
                  <p className="text-2xl font-bold mt-1">{rule.count}</p>
                  <p className="text-sm text-muted-foreground mt-2">{rule.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24">
            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">이번 주 실행 계획</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  분석 결과를 바로 행동으로 옮길 수 있게 3단계로 나눴습니다.
                </p>
              </div>
              <div className="space-y-3">
                {weeklyPlan.map((step, index) => (
                  <div key={step.title} className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {index + 1}
                      </span>
                      <p className="font-semibold text-sm">{step.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">판단 근거</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  왜 이런 전략이 나왔는지 한눈에 확인하세요.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                  <p className="font-medium text-red-700 mb-1">우선 보강 신호</p>
                  <p className="text-red-600 text-xs">
                    평균 60점 미만, 최근 하락, 또는 변동성이 큰 과목은 즉시 개입이 필요합니다.
                  </p>
                </div>
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2.5">
                  <p className="font-medium text-yellow-700 mb-1">유지 관리 신호</p>
                  <p className="text-yellow-600 text-xs">
                    60~79점대 과목은 조금만 흔들려도 위험해지므로 짧고 자주 복습하는 편이 좋습니다.
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
                  <p className="font-medium text-green-700 mb-1">강점 유지 신호</p>
                  <p className="text-green-600 text-xs">
                    80점 이상 과목은 유지 루틴만 정리하면 다른 과목에 집중할 시간을 확보할 수 있습니다.
                  </p>
                </div>
                {lowData.length > 0 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
                    <p className="font-medium text-gray-700 mb-1">데이터 부족</p>
                    <p className="text-gray-600 text-xs">
                      {summarizeSubjects(lowData.slice(0, 3))} 과목은 기록을 더 쌓은 뒤 더 정교한 전략이 가능합니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
