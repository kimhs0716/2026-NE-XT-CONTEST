import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { computeStrategy } from "@/lib/analytics/strategy";
import { computePrediction } from "@/lib/analytics/prediction";
import type { GradePoint, RiskLevel, SubjectMetrics } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";
import RecommendationTaskButton from "@/components/strategy/RecommendationTaskButton";
import GenerateRecommendationsButton from "@/components/strategy/GenerateRecommendationsButton";
import RecommendationCard, { type RecommendationCardValue } from "@/components/strategy/RecommendationCard";

type ExamRow = {
  subjects: { id: string; name: string } | { id: string; name: string }[] | null;
  semesters:
    | { year: number; semester_type: string }
    | { year: number; semester_type: string }[]
    | null;
  grade_records: { percentage: number }[];
};

type StudyLogRow = {
  study_date: string;
  duration_minutes: number | null;
  concentration_level: number | null;
  subjects: { name: string } | { name: string }[] | null;
};

type StudyTaskRow = {
  title: string;
  due_date: string | null;
  is_completed: boolean;
  priority: string | null;
  subjects: { name: string } | { name: string }[] | null;
};

type ScheduleRow = {
  title: string;
  event_type: string;
  start_date: string;
  is_completed: boolean;
  subjects: { name: string } | { name: string }[] | null;
};

type WeaknessReportRow = {
  id: string;
  title: string;
  description: string | null;
  severity: number | null;
  evidence: string | null;
  weakness_type: string | null;
  subjects: { name: string } | { name: string }[] | null;
};

type RecommendationRow = {
  id: string;
  title: string;
  description: string;
  priority: string | null;
  recommendation_type: string | null;
  subjects: { name: string } | { name: string }[] | null;
  weakness_reports: { title: string } | { title: string }[] | null;
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

type PlanMode = "exam" | "task" | "routine";

type SubjectPlanSignal = {
  subject: string;
  riskLevel: RiskLevel;
  riskScore: number;
  studyDeficitScore: number;
  concentrationPenalty: number;
  examUrgencyScore: number;
  taskUrgencyScore: number;
  priorityScore: number;
  reasons: string[];
  recentStudyMinutes: number;
  avgConcentration: number | null;
  examDaysLeft: number | null;
  taskDaysLeft: number | null;
  targetMinutes: number;
  recommendedAction: string;
  latestScore: number;
  trend: string;
  riskReason: string;
  examTitle: string | null;
  taskTitle: string | null;
  taskPriority: string | null;
  mockWeak: boolean;
};

type WeeklyPlanItem = {
  title: string;
  description: string;
  subject: string;
  action: string;
  durationMinutes: number;
  reason: string;
  priority: "highest" | "normal" | "maintenance";
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

const planModeConfig: Record<PlanMode, { label: string; cls: string; description: string }> = {
  exam: {
    label: "시험 우선",
    cls: "bg-rose-100 text-rose-700",
    description: "가까운 시험과 마감일을 우선 반영했습니다.",
  },
  task: {
    label: "마감 우선",
    cls: "bg-amber-100 text-amber-700",
    description: "마감이 가까운 과제를 먼저 확인합니다.",
  },
  routine: {
    label: "일상 학습",
    cls: "bg-sky-100 text-sky-700",
    description: "최근 점수 흐름과 공부 기록을 바탕으로 정리했습니다.",
  },
};

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

function extractSubjectName(subjects: { name: string } | { name: string }[] | null): string | null {
  if (!subjects) return null;
  return Array.isArray(subjects) ? subjects[0]?.name ?? null : subjects.name;
}

function extractWeaknessTitle(weakness: { title: string } | { title: string }[] | null): string | null {
  if (!weakness) return null;
  return Array.isArray(weakness) ? weakness[0]?.title ?? null : weakness.title;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getTodayUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function parseDateOnly(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysUntil(dateStr: string): number {
  return Math.round((parseDateOnly(dateStr) - getTodayUtcMidnight()) / MS_PER_DAY);
}

function daysSince(dateStr: string): number {
  return Math.round((getTodayUtcMidnight() - parseDateOnly(dateStr)) / MS_PER_DAY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isUpcomingExamSchedule(row: ScheduleRow): boolean {
  if (row.is_completed) return false;
  return row.event_type === "exam" || row.event_type === "mock_exam";
}

function computeStrategyInsights(rows: ExamRow[]): StrategyInsight[] {
  const map = new Map<
    string,
    { grades: GradePoint[]; latestSemester: string; latestSemOrder: number }
  >();

  for (const r of rows) {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) continue;
    const name = extractSubjectName(r.subjects);
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

function getRiskScore(riskLevel: RiskLevel): number {
  if (riskLevel === "high") return 1;
  if (riskLevel === "medium") return 0.6;
  if (riskLevel === "low") return 0.2;
  return 0.35;
}

function getTargetMinutes(riskLevel: RiskLevel, examDaysLeft: number | null): number {
  let targetMinutes = riskLevel === "high" ? 180 : riskLevel === "medium" ? 120 : 60;
  if (examDaysLeft !== null && examDaysLeft <= 7) targetMinutes *= 1.5;
  if (examDaysLeft !== null && examDaysLeft <= 3) targetMinutes *= 2;
  return targetMinutes;
}

function getConcentrationPenalty(avgConcentration: number | null): number {
  if (avgConcentration === null) return 0;
  if (avgConcentration < 2.5) return 0.25;
  if (avgConcentration < 3.5) return 0.1;
  return 0;
}

function getExamUrgencyScore(daysLeft: number | null): number {
  if (daysLeft === null || daysLeft < 0 || daysLeft > 14) return 0;
  return (14 - daysLeft) / 14;
}

function getTaskUrgencyScore(daysLeft: number | null): number {
  if (daysLeft === null || daysLeft < 0 || daysLeft > 7) return 0;
  return (7 - daysLeft) / 7;
}

function getMode(upcomingExamCount: number, urgentTaskCount: number): PlanMode {
  if (upcomingExamCount > 0) return "exam";
  if (urgentTaskCount > 0) return "task";
  return "routine";
}

function buildAction(signal: SubjectPlanSignal, mode: PlanMode, rank: number): string {
  if (signal.examDaysLeft !== null && signal.examDaysLeft <= 3) {
    return "시험 범위 핵심 개념 1회독 + 틀린 문제 5개 정리";
  }

  if (signal.taskDaysLeft !== null && signal.taskDaysLeft <= 2) {
    return "제출 요건 확인 후 과제 완료";
  }

  if (signal.riskLevel === "high" && signal.recentStudyMinutes === 0) {
    return "개념 정리 1회독 + 대표 문제 10개";
  }

  if (mode === "exam") {
    if (rank === 0) return "시험 범위 핵심 개념 1회독 + 오답 5개 정리";
    return "이번 주 3회, 각 30분씩 오답 유형 반복";
  }

  if (mode === "task") {
    if (rank === 0) return "마감 요건 확인 후 과제 초안 완성";
    return "제출 전 체크리스트로 누락 항목 점검";
  }

  if (signal.riskLevel === "low") {
    return "시험 직전 1회 점검 + 취약 파트만 복습";
  }

  if (signal.riskLevel === "medium") {
    return "이번 주 3회, 각 30분씩 오답 유형 반복";
  }

  if (signal.recentStudyMinutes < 60) {
    return "짧은 개념 복습 + 대표 문제 5개";
  }

  return "유지 학습 중심으로 꾸준히 복습";
}

function buildWeeklyPlanItem(signal: SubjectPlanSignal, mode: PlanMode, rank: number): WeeklyPlanItem {
  const hasExamDeadline = signal.examDaysLeft !== null && signal.examDaysLeft >= 0;
  const hasTaskDeadline = signal.taskDaysLeft !== null && signal.taskDaysLeft >= 0;
  const deadlineLabel = hasExamDeadline
    ? `D-${signal.examDaysLeft}`
    : hasTaskDeadline
      ? `D-${signal.taskDaysLeft}`
      : null;

  const durationMinutes =
    rank === 0
      ? signal.examDaysLeft !== null && signal.examDaysLeft <= 3
        ? 40
        : signal.taskDaysLeft !== null && signal.taskDaysLeft <= 2
          ? 35
          : 30
      : rank === 1
        ? 30
        : 20;

  const title = (() => {
    if (signal.taskDaysLeft !== null && signal.taskDaysLeft <= 2) {
      return `${signal.subject} 과제 ${deadlineLabel ?? "오늘"} 처리`;
    }
    if (signal.examDaysLeft !== null && signal.examDaysLeft <= 3) {
      return `${signal.subject} ${deadlineLabel ?? "오늘"} 집중`;
    }
    if (signal.riskLevel === "high") {
      return `오늘 ${signal.subject} ${durationMinutes}분 먼저`;
    }
    if (signal.riskLevel === "medium") {
      return `${signal.subject} ${durationMinutes}분 반복`;
    }
    return `${signal.subject} 유지 ${durationMinutes}분`;
  })();

  const descriptionParts = [
    signal.reasons[0] || signal.riskReason || `${signal.subject}의 현재 상태를 점검하세요.`,
    signal.recentStudyMinutes === 0 ? "최근 7일 공부 기록이 없어 우선 배치했습니다." : null,
    signal.avgConcentration !== null && signal.avgConcentration < 3.5
      ? `집중도 평균 ${signal.avgConcentration.toFixed(1)}점이라 학습 방식도 함께 조정합니다.`
      : null,
  ].filter((part): part is string => Boolean(part));

  const reason = signal.reasons.join(" · ") || signal.riskReason || "기록이 더 쌓이면 이유를 보여드릴게요";

  return {
    title,
    description: descriptionParts.join(" "),
    subject: signal.subject,
    action: buildAction(signal, mode, rank),
    durationMinutes,
    reason,
    priority: rank === 0 ? "highest" : rank === 2 ? "maintenance" : "normal",
  };
}

function buildSubjectPlanSignals(params: {
  insights: StrategyInsight[];
  studyLogs: StudyLogRow[];
  studyTasks: StudyTaskRow[];
  schedules: ScheduleRow[];
  mockWeakSubjects?: Set<string>;
}): SubjectPlanSignal[] {
  const { insights, studyLogs, studyTasks, schedules, mockWeakSubjects = new Set<string>() } = params;
  const buckets = new Map<
    string,
    {
      latestInsight: StrategyInsight | null;
      recentStudyMinutes: number;
      concentrationSum: number;
      concentrationCount: number;
      examDaysLeft: number | null;
      examTitle: string | null;
      taskDaysLeft: number | null;
      taskTitle: string | null;
      taskPriority: string | null;
    }
  >();

  const ensureBucket = (subject: string) => {
    if (!buckets.has(subject)) {
      buckets.set(subject, {
        latestInsight: null,
        recentStudyMinutes: 0,
        concentrationSum: 0,
        concentrationCount: 0,
        examDaysLeft: null,
        examTitle: null,
        taskDaysLeft: null,
        taskTitle: null,
        taskPriority: null,
      });
    }
    return buckets.get(subject)!;
  };

  for (const insight of insights) {
    ensureBucket(insight.subject).latestInsight = insight;
  }

  for (const log of studyLogs) {
    const subject = extractSubjectName(log.subjects) ?? "기타";
    const bucket = ensureBucket(subject);
    const recentDays = daysSince(log.study_date);
    const duration = log.duration_minutes ?? 0;

    if (recentDays >= 0 && recentDays <= 7) {
      bucket.recentStudyMinutes += duration;
    }
    if (recentDays >= 0 && recentDays <= 14 && log.concentration_level != null) {
      bucket.concentrationSum += log.concentration_level;
      bucket.concentrationCount += 1;
    }
  }

  for (const schedule of schedules) {
    if (!isUpcomingExamSchedule(schedule)) continue;
    const daysLeft = daysUntil(schedule.start_date);
    if (daysLeft < 0 || daysLeft > 14) continue;

    const subject = extractSubjectName(schedule.subjects) ?? "기타";
    const bucket = ensureBucket(subject);
    if (bucket.examDaysLeft === null || daysLeft < bucket.examDaysLeft) {
      bucket.examDaysLeft = daysLeft;
      bucket.examTitle = schedule.title;
    }
  }

  for (const task of studyTasks) {
    if (task.is_completed || !task.due_date) continue;
    const daysLeft = daysUntil(task.due_date);
    if (daysLeft < 0 || daysLeft > 7) continue;

    const subject = extractSubjectName(task.subjects) ?? "기타";
    const bucket = ensureBucket(subject);
    if (bucket.taskDaysLeft === null || daysLeft < bucket.taskDaysLeft) {
      bucket.taskDaysLeft = daysLeft;
      bucket.taskTitle = task.title;
      bucket.taskPriority = task.priority;
    }
  }

  return [...buckets.entries()]
    .map(([subject, bucket]) => {
      const insight = bucket.latestInsight;
      const riskLevel = insight?.riskLevel ?? "insufficient";
      const riskScore = getRiskScore(riskLevel);
      const avgConcentration =
        bucket.concentrationCount > 0 ? bucket.concentrationSum / bucket.concentrationCount : null;
      const examDaysLeft = bucket.examDaysLeft;
      const taskDaysLeft = bucket.taskDaysLeft;
      const targetMinutes = getTargetMinutes(riskLevel, examDaysLeft);
      const studyDeficitScore = clamp((targetMinutes - bucket.recentStudyMinutes) / targetMinutes, 0, 1);
      const concentrationPenalty = getConcentrationPenalty(avgConcentration);
      const examUrgencyScore = getExamUrgencyScore(examDaysLeft);
      const taskUrgencyScore = getTaskUrgencyScore(taskDaysLeft);
      const mockWeak = mockWeakSubjects.has(subject);

      const reasons: string[] = [];
      if (insight?.riskReason) reasons.push(insight.riskReason);
      if (mockWeak) reasons.push("최근 모의고사 보완 필요");
      if (examDaysLeft !== null) reasons.push(`시험 D-${examDaysLeft}`);
      if (taskDaysLeft !== null) reasons.push(`과제 D-${taskDaysLeft}`);
      if (bucket.recentStudyMinutes === 0) reasons.push("최근 7일 공부 기록 0분");
      else reasons.push(`최근 7일 ${bucket.recentStudyMinutes}분 공부`);
      if (avgConcentration !== null) reasons.push(`집중도 평균 ${avgConcentration.toFixed(1)}점`);

      return {
        subject,
        riskLevel,
        riskScore,
        studyDeficitScore,
        concentrationPenalty,
        examUrgencyScore,
        taskUrgencyScore,
        priorityScore: 0,
        reasons,
        recentStudyMinutes: bucket.recentStudyMinutes,
        avgConcentration,
        examDaysLeft,
        taskDaysLeft,
        targetMinutes,
        recommendedAction:
          insight?.recommendedAction ??
          (riskLevel === "insufficient"
            ? "성적 기록을 더 추가하면 맞춤 전략이 생성됩니다"
            : "유지 학습 중심으로 꾸준히 복습"),
        latestScore: insight?.latestScore ?? 0,
        trend: insight?.trend ?? "new",
        riskReason: insight?.riskReason ?? "",
        examTitle: bucket.examTitle,
        taskTitle: bucket.taskTitle,
        taskPriority: bucket.taskPriority,
        mockWeak,
      } satisfies SubjectPlanSignal;
    })
    .map((signal) => {
      let priorityScore = 0;

      if (signal.examDaysLeft !== null && signal.examDaysLeft <= 14) {
        priorityScore += signal.examUrgencyScore * 0.35;
      }
      if (signal.taskDaysLeft !== null && signal.taskDaysLeft <= 7) {
        priorityScore += signal.taskUrgencyScore * 0.35;
      }

      if (signal.examDaysLeft !== null && signal.examDaysLeft <= 3) priorityScore += 0.25;
      if (signal.taskDaysLeft !== null && signal.taskDaysLeft <= 2) priorityScore += 0.15;
      if (signal.riskLevel === "high" && signal.recentStudyMinutes === 0) priorityScore += 0.2;
      if (signal.mockWeak) priorityScore += 0.18;

      return {
        ...signal,
        priorityScore:
          Math.round(
            (priorityScore +
              (signal.riskLevel === "high"
                ? signal.studyDeficitScore * 0.3 + signal.concentrationPenalty
                : signal.riskLevel === "medium"
                  ? signal.studyDeficitScore * 0.25 + signal.concentrationPenalty * 0.1
                  : signal.riskLevel === "low"
                    ? signal.studyDeficitScore * 0.35 + signal.concentrationPenalty * 0.2
                    : signal.studyDeficitScore * 0.2 + signal.concentrationPenalty * 0.1)) *
              1000,
          ) / 1000,
      } satisfies SubjectPlanSignal;
    })
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        b.examUrgencyScore - a.examUrgencyScore ||
        b.taskUrgencyScore - a.taskUrgencyScore ||
        a.subject.localeCompare(b.subject, "ko"),
    );
}

function getPlanModeLabel(mode: PlanMode): string {
  return planModeConfig[mode].label;
}

function getWeeklyPriorityLabel(priority: WeeklyPlanItem["priority"]): string {
  if (priority === "highest") return "최우선";
  if (priority === "maintenance") return "유지";
  return "보통";
}

function subjectCategory(name: string): string {
  const idx = name.indexOf("(");
  return idx > 0 ? name.slice(0, idx) : name;
}

type CategoryInsight = {
  category: string;
  subjects: string[];
  avgScore: number;
  latestAvg: number;
  recentDelta: number | null;
  riskLevel: RiskLevel;
  riskReason: string;
  recommendedAction: string;
  count: number;
  trend: string;
};

type MockExamRow = {
  exam_year: number;
  exam_month: number;
  subject: string;
  raw_score: number | null;
  percentile: number | null;
  grade: number | null;
  target_score: number | null;
};

type MockExamInsight = {
  subject: string;
  latestLabel: string;
  latestScore: number | null;
  averageScore: number | null;
  latestGrade: number | null;
  averageGrade: number | null;
  percentile: number | null;
  targetScore: number | null;
  targetGap: number | null;
  recentDelta: number | null;
  count: number;
  riskLevel: RiskLevel;
  riskReason: string;
  recommendedAction: string;
  trend: string;
};

function buildCategoryInsights(insights: StrategyInsight[]): CategoryInsight[] {
  const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, insufficient: 3 };
  const groups = new Map<string, StrategyInsight[]>();
  for (const insight of insights) {
    const cat = subjectCategory(insight.subject);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(insight);
  }
  return [...groups.entries()]
    .map(([category, items]) => {
      const sorted = [...items].sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
      const worst = sorted[0];
      const avgScore = items.reduce((sum, i) => sum + i.average, 0) / items.length;
      const latestAvg = items.reduce((sum, i) => sum + i.latestScore, 0) / items.length;
      const deltas = items.map((i) => i.recentDelta).filter((d): d is number => d !== null);
      const recentDelta =
        deltas.length > 0
          ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
          : null;
      return {
        category,
        subjects: items.map((i) => i.subject),
        avgScore: Math.round(avgScore * 10) / 10,
        latestAvg: Math.round(latestAvg * 10) / 10,
        recentDelta,
        riskLevel: worst.riskLevel,
        riskReason: worst.riskReason,
        recommendedAction: worst.recommendedAction,
        count: items.reduce((sum, i) => sum + i.count, 0),
        trend: worst.trend,
      };
    })
    .sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || a.avgScore - b.avgScore);
}

function scoreAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function buildMockExamAction(params: {
  subject: string;
  riskLevel: RiskLevel;
  recentDelta: number | null;
  targetGap: number | null;
  latestGrade: number | null;
}): string {
  const { subject, riskLevel, recentDelta, targetGap, latestGrade } = params;

  if (targetGap !== null && targetGap <= -10) {
    return `${subject} 목표까지 ${Math.abs(targetGap)}점 남았습니다. 오답 유형 2개를 골라 기출 10문항으로 바로 보강하세요.`;
  }

  if (recentDelta !== null && recentDelta <= -5) {
    return `${subject} 최근 점수가 내려갔습니다. 직전 시험 오답을 단원별로 나누고 하락 단원부터 다시 풀어보세요.`;
  }

  if (latestGrade !== null && latestGrade >= 5) {
    return `${subject} 기본 개념 빈칸을 먼저 줄여야 합니다. 개념 확인 20분 후 쉬운 문항부터 정확도를 회복하세요.`;
  }

  if (riskLevel === "medium") {
    return `${subject} 등급을 끌어올릴 여지가 있습니다. 실수 문항과 시간 부족 문항을 분리해 반복하세요.`;
  }

  if (riskLevel === "low") {
    return `${subject}는 현재 안정권입니다. 주 1회 실전 세트로 감각을 유지하고 고난도만 선별하세요.`;
  }

  return `${subject} 기록을 한 번 더 추가하면 추세까지 반영한 전략을 만들 수 있습니다.`;
}

function buildMockExamInsights(rows: MockExamRow[]): MockExamInsight[] {
  const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2, insufficient: 3 };
  const groups = new Map<string, MockExamRow[]>();

  for (const row of rows) {
    if (!groups.has(row.subject)) groups.set(row.subject, []);
    groups.get(row.subject)!.push(row);
  }

  return [...groups.entries()]
    .map(([subject, items]) => {
      const sorted = [...items].sort(
        (a, b) => a.exam_year * 100 + a.exam_month - (b.exam_year * 100 + b.exam_month),
      );
      const latest = sorted[sorted.length - 1];
      const rawScores = sorted.map((row) => row.raw_score).filter((score): score is number => score != null);
      const grades = sorted.map((row) => row.grade).filter((grade): grade is number => grade != null);
      const latestScore = latest.raw_score;
      const latestGrade = latest.grade;
      const previousScore = rawScores.length > 1 ? rawScores[rawScores.length - 2] : null;
      const recentDelta =
        latestScore !== null && previousScore !== null
          ? Math.round((latestScore - previousScore) * 10) / 10
          : null;
      const targetGap =
        latestScore !== null && latest.target_score !== null
          ? Math.round((latestScore - latest.target_score) * 10) / 10
          : null;

      let trend: SubjectMetrics["trend"] = "new";
      if (recentDelta !== null) {
        if (recentDelta > 3) trend = "up";
        else if (recentDelta < -3) trend = "down";
        else trend = "stable";
      }

      const riskLevel: RiskLevel =
        latestGrade == null && latestScore == null
          ? "insufficient"
          : (latestGrade != null && latestGrade >= 5) || (targetGap != null && targetGap <= -10)
            ? "high"
            : (latestGrade != null && latestGrade >= 3) || (targetGap != null && targetGap < 0) || (recentDelta != null && recentDelta <= -5)
              ? "medium"
              : "low";

      const riskReason = (() => {
        if (riskLevel === "insufficient") return "원점수나 등급 기록이 더 필요합니다.";
        if (targetGap !== null && targetGap < 0) return `목표 점수보다 ${Math.abs(targetGap)}점 낮습니다.`;
        if (recentDelta !== null && recentDelta < 0) return `직전 기록보다 ${Math.abs(recentDelta)}점 하락했습니다.`;
        if (latestGrade !== null && latestGrade >= 5) return `${latestGrade}등급 구간이라 기본 개념 보강이 우선입니다.`;
        if (latestGrade !== null && latestGrade >= 3) return `${latestGrade}등급 구간에서 한 단계 상승 여지가 있습니다.`;
        return "최근 기록이 목표권에 있어 실전 감각 유지가 중요합니다.";
      })();

      return {
        subject,
        latestLabel: `${latest.exam_year}년 ${latest.exam_month}월`,
        latestScore,
        averageScore: scoreAverage(rawScores),
        latestGrade,
        averageGrade: scoreAverage(grades),
        percentile: latest.percentile,
        targetScore: latest.target_score,
        targetGap,
        recentDelta,
        count: rawScores.length || grades.length,
        riskLevel,
        riskReason,
        recommendedAction: buildMockExamAction({ subject, riskLevel, recentDelta, targetGap, latestGrade }),
        trend,
      };
    })
    .sort(
      (a, b) =>
        riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
        (b.latestGrade ?? 0) - (a.latestGrade ?? 0) ||
        (a.targetGap ?? 99) - (b.targetGap ?? 99) ||
        a.subject.localeCompare(b.subject, "ko"),
    );
}

function buildMockWeakSubjectSet(
  rows: {
    exam_year: number;
    exam_month: number;
    subject: string;
    raw_score: number | null;
    grade: number | null;
    target_score: number | null;
  }[],
): Set<string> {
  if (rows.length === 0) return new Set();
  const latest = rows.reduce((best, row) => {
    const bestOrder = best.exam_year * 100 + best.exam_month;
    const rowOrder = row.exam_year * 100 + row.exam_month;
    return rowOrder > bestOrder ? row : best;
  }, rows[0]);
  const latestOrder = latest.exam_year * 100 + latest.exam_month;
  return new Set(
    rows
      .filter((row) => row.exam_year * 100 + row.exam_month === latestOrder)
      .filter((row) => (row.grade != null && row.grade >= 4) || (row.target_score != null && row.raw_score != null && row.target_score - row.raw_score >= 10))
      .map((row) => row.subject),
  );
}

export default async function StrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: rows },
    { data: profileData },
    { data: studyLogRows },
    { data: studyTaskRows },
    { data: scheduleRows },
    { data: weaknessRows },
    { data: recommendationRows },
    { data: mockExamRows },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        subjects ( id, name ),
        semesters!exam_semester ( year, semester_type ),
        grade_records ( percentage )
      `)
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("school_level, name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("study_logs")
      .select(`study_date, duration_minutes, concentration_level, subjects ( name )`)
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(120),
    supabase
      .from("study_tasks")
      .select(`title, due_date, is_completed, priority, subjects ( name )`)
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(80),
    supabase
      .from("schedules")
      .select(`title, event_type, start_date, is_completed, subjects ( name )`)
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("start_date", { ascending: true })
      .limit(80),
    supabase
      .from("weakness_reports")
      .select(`id, title, description, severity, evidence, weakness_type, subjects ( name )`)
      .eq("user_id", user.id)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("learning_recommendations")
      .select(`id, title, description, priority, recommendation_type, subjects ( name ), weakness_reports ( title )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("mock_exam_records")
      .select("exam_year, exam_month, subject, raw_score, percentile, grade, target_score")
      .eq("user_id", user.id)
      .order("exam_year", { ascending: false })
      .order("exam_month", { ascending: false })
      .limit(24),
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

  const categoryInsights = buildCategoryInsights(insights);
  const topCategoryInsight = categoryInsights[0] ?? null;

  const allMockRows = (mockExamRows ?? []) as MockExamRow[];
  const mockExamInsights = buildMockExamInsights(allMockRows);
  const latestMockRow =
    allMockRows.length > 0
      ? allMockRows.reduce(
          (best, row) =>
            row.exam_year * 100 + row.exam_month > best.exam_year * 100 + best.exam_month ? row : best,
          allMockRows[0],
        )
      : null;
  const latestMockLabel = latestMockRow ? `${latestMockRow.exam_year}년 ${latestMockRow.exam_month}월` : "";

  const studyLogs = (studyLogRows ?? []) as StudyLogRow[];
  const studyTasks = (studyTaskRows ?? []) as StudyTaskRow[];
  const schedules = (scheduleRows ?? []) as ScheduleRow[];
  const mockWeakSubjects = buildMockWeakSubjectSet((mockExamRows ?? []) as {
    exam_year: number;
    exam_month: number;
    subject: string;
    raw_score: number | null;
    grade: number | null;
    target_score: number | null;
  }[]);
  const weaknessReports = ((weaknessRows ?? []) as WeaknessReportRow[]).map((report) => ({
    ...report,
    subject: extractSubjectName(report.subjects) ?? "기타",
  }));
  const recommendations: RecommendationCardValue[] = ((recommendationRows ?? []) as RecommendationRow[]).map(
    (recommendation) => ({
      id: recommendation.id,
      title: recommendation.title,
      description: recommendation.description,
      priority: recommendation.priority,
      recommendationType: recommendation.recommendation_type,
      subject: extractSubjectName(recommendation.subjects) ?? "기타",
      weaknessTitle: extractWeaknessTitle(recommendation.weakness_reports),
    }),
  );
  const subjectIdByName = new Map<string, string>();
  for (const row of (rows ?? []) as ExamRow[]) {
    const subjectRow = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    if (subjectRow?.name && subjectRow.id && !subjectIdByName.has(subjectRow.name)) {
      subjectIdByName.set(subjectRow.name, subjectRow.id);
    }
  }

  const upcomingExamCount = schedules.filter(isUpcomingExamSchedule).filter((schedule) => {
    const daysLeft = daysUntil(schedule.start_date);
    return daysLeft >= 0 && daysLeft <= 14;
  }).length;

  const urgentTaskCount = studyTasks.filter((task) => {
    if (task.is_completed || !task.due_date) return false;
    const daysLeft = daysUntil(task.due_date);
    return daysLeft >= 0 && daysLeft <= 7;
  }).length;

  const planMode = getMode(upcomingExamCount, urgentTaskCount);
  const planSignals = buildSubjectPlanSignals({
    insights,
    studyLogs,
    studyTasks,
    schedules,
    mockWeakSubjects,
  });

  const weeklyPlan = planSignals.slice(0, 3).map((signal, index) => buildWeeklyPlanItem(signal, planMode, index));

  const schoolLevelLabel = schoolLevel === "high" ? "고등학생 기준: 내신 + 모의고사" : "중학생 기준: 내신 중심";
  const planModeInfo = planModeConfig[planMode];

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">맞춤전략</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {userName ? `${userName}님, ` : ""}{schoolLevelLabel}에 맞춰 지금 당장 실행할 순서로 정리한 학습 전략입니다.
        </p>
      </div>

      {insights.length === 0 && mockExamInsights.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center text-muted-foreground text-sm">
          성적을 등록하면 과목별 실행 계획이 자동으로 만들어집니다.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_450px] items-start">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border bg-white p-5">
                <p className="text-xs text-muted-foreground mb-1">전체 평균</p>
                <p className="text-2xl font-bold">{overallAvg != null ? `${overallAvg}점` : "-"}</p>
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

            <div className="rounded-2xl border bg-white p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold">우선순위</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    평균과 최근 흐름을 함께 반영한 실행 순서입니다.
                  </p>
                </div>
                {topCategoryInsight && (
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", riskConfig[topCategoryInsight.riskLevel].cls)}>
                    지금 가장 먼저 볼 분류: {topCategoryInsight.category}
                  </span>
                )}
              </div>

              {/* 내신 */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">내신</p>
                <div className="space-y-3">
                  {categoryInsights.map((item) => {
                    const trend = trendConfig[item.trend] ?? trendConfig.new;
                    return (
                      <div key={item.category} className="rounded-xl border p-4 bg-muted/20">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", subjectBadgeClass(item.category))}>
                                {item.category}
                              </span>
                              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", riskConfig[item.riskLevel].cls)}>
                                {riskConfig[item.riskLevel].label}
                              </span>
                              <span className={cn("text-xs font-semibold", trend.cls)}>
                                {trend.icon} {trend.label}
                              </span>
                              {item.subjects.length > 1 && (
                                <span className="text-[11px] text-muted-foreground">
                                  {item.subjects.join(" · ")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">{item.recommendedAction}</p>
                            <p className="text-xs text-muted-foreground">
                              최근 변화 {formatDelta(item.recentDelta)} · 기록 {item.count}회
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-center shrink-0">
                            <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                              <p className="text-[10px] text-muted-foreground">평균</p>
                              <p className="font-bold">{item.avgScore}점</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                              <p className="text-[10px] text-muted-foreground">최근 점수</p>
                              <p className="font-bold">{item.latestAvg}점</p>
                            </div>
                          </div>
                        </div>
                        {item.riskReason && (
                          <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-muted-foreground border">
                            {item.riskReason}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 모의고사 */}
              {mockExamInsights.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground">모의고사</p>
                    <span className="text-xs text-muted-foreground">· 최근 기준 {latestMockLabel}</span>
                  </div>
                  <div className="space-y-3">
                    {mockExamInsights.map((item) => {
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
                                <span className="text-[11px] text-muted-foreground">
                                  {item.latestLabel} · 기록 {item.count}회
                                </span>
                              </div>
                              <p className="text-sm font-medium text-foreground">{item.recommendedAction}</p>
                              <p className="text-xs text-muted-foreground">
                                최근 변화 {formatDelta(item.recentDelta)}
                                {item.targetGap !== null && item.targetScore !== null && (
                                  <>
                                    {" "}· 목표 {item.targetScore}점 대비{" "}
                                    <span className={item.targetGap >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                                      {formatDelta(item.targetGap)}
                                    </span>
                                  </>
                                )}
                                {item.percentile !== null && <> · 백분위 {item.percentile}</>}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-center shrink-0">
                              <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                                <p className="text-[10px] text-muted-foreground">최근 원점수</p>
                                <p className="font-bold">{item.latestScore != null ? `${item.latestScore}점` : "-"}</p>
                              </div>
                              <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                                <p className="text-[10px] text-muted-foreground">최근 등급</p>
                                <p className="font-bold">{item.latestGrade != null ? `${item.latestGrade}등급` : "-"}</p>
                              </div>
                              <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                                <p className="text-[10px] text-muted-foreground">평균 원점수</p>
                                <p className="font-bold">{item.averageScore != null ? `${item.averageScore}점` : "-"}</p>
                              </div>
                              <div className="rounded-lg bg-white px-3 py-2 border min-w-[82px]">
                                <p className="text-[10px] text-muted-foreground">평균 등급</p>
                                <p className="font-bold">{item.averageGrade != null ? `${item.averageGrade}등급` : "-"}</p>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-muted-foreground border">
                            {item.riskReason}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">추가로 해볼 만한 학습</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    필요하면 이번 주 할 일에 추가해 보세요.
                  </p>
                </div>
                <GenerateRecommendationsButton />
              </div>

              {weaknessReports.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {weaknessReports.slice(0, 4).map((report) => (
                    <span
                      key={report.id}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        subjectBadgeClass(report.subject),
                      )}
                    >
                      {report.subject}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid gap-3 xl:grid-cols-2">
                {recommendations.length > 0 ? (
                  recommendations.slice(0, 4).map((recommendation) => (
                    <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                  ))
                ) : (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground xl:col-span-2">
                    추천 만들기를 누르면 현재 기록을 바탕으로 학습 제안을 정리합니다.
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-primary/20 bg-white p-6 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">이번 주 실행 계획</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    이번 주에 우선 실행할 학습 항목입니다.
                  </p>
                </div>
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium shrink-0", planModeInfo.cls)}>
                  {getPlanModeLabel(planMode)}
                </span>
              </div>
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {planModeInfo.description}
              </div>
              <div className="space-y-3">
                {weeklyPlan.map((step, index) => (
                  <div
                    key={`${step.subject}-${step.title}`}
                    className="rounded-xl border bg-muted/20 p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {index + 1}
                      </span>
                      <p className="font-semibold text-sm">{step.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className={cn("rounded-full px-2 py-0.5 font-medium", subjectBadgeClass(step.subject))}>
                        {step.subject}
                      </span>
                      <span className="rounded-full bg-white border px-2 py-0.5 text-muted-foreground">
                        {step.durationMinutes}분
                      </span>
                      <span className="rounded-full bg-white border px-2 py-0.5 text-muted-foreground">
                        {getWeeklyPriorityLabel(step.priority)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">{step.action}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{step.reason}</p>
                    <div className="mt-3">
                      <RecommendationTaskButton
                        subjectId={subjectIdByName.get(step.subject) ?? null}
                        title={step.title}
                        description={step.action}
                        priority={step.priority === "highest" ? "high" : step.priority === "maintenance" ? "low" : "medium"}
                      />
                    </div>
                  </div>
                ))}
                {weeklyPlan.length === 0 && (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    이번 주에 바로 실행할 과목이 아직 없어요. 성적, 공부 기록, 일정이 쌓이면 계획이 생성됩니다.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">계획에 반영한 기준</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                  <p className="font-medium text-red-700 mb-1">최근 점수 흐름</p>
                  <p className="text-red-600 text-xs">
                    최근 점수 흐름과 평균 점수를 함께 봅니다.
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                  <p className="font-medium text-blue-700 mb-1">공부 기록</p>
                  <p className="text-blue-600 text-xs">
                    공부 기록이 적은 과목은 먼저 확인하도록 제안합니다.
                  </p>
                </div>
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2.5">
                  <p className="font-medium text-yellow-700 mb-1">집중도</p>
                  <p className="text-yellow-600 text-xs">
                    집중도가 낮게 기록된 과목은 공부 방식 점검을 함께 제안합니다.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                  <p className="font-medium text-emerald-700 mb-1">시험·과제 일정</p>
                  <p className="text-emerald-600 text-xs">
                    가까운 시험이나 마감일이 있으면 우선순위를 높입니다.
                  </p>
                </div>
                {lowData.length > 0 && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
                    <p className="font-medium text-gray-700 mb-1">기록 부족</p>
                    <p className="text-gray-600 text-xs">
                      {summarizeSubjects(lowData.slice(0, 3))} 과목은 기록이 더 쌓이면 더 정확한 제안이 가능합니다.
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
