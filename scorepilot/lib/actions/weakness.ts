"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { buildWeaknessDraft, type WeaknessSignal } from "@/lib/analytics/weakness";
import { buildRecommendationDraft } from "@/lib/analytics/recommendations";
import type { GradePoint } from "@/lib/analytics/types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
  subjects: { id: string; name: string } | { id: string; name: string }[] | null;
};

type StudyTaskRow = {
  due_date: string | null;
  is_completed: boolean;
  subjects: { id: string; name: string } | { id: string; name: string }[] | null;
};

type ScheduleRow = {
  event_type: string;
  start_date: string;
  is_completed: boolean;
  subjects: { id: string; name: string } | { id: string; name: string }[] | null;
};

type GoalRow = {
  target_score: number | null;
  subjects: { id: string; name: string } | { id: string; name: string }[] | null;
};

function getOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function todayUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function parseDateOnly(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysUntil(dateStr: string): number {
  return Math.round((parseDateOnly(dateStr) - todayUtcMidnight()) / MS_PER_DAY);
}

function daysSince(dateStr: string): number {
  return Math.round((todayUtcMidnight() - parseDateOnly(dateStr)) / MS_PER_DAY);
}

function semOrder(year: number, type: SemesterType): number {
  return year * 10 + (type === "semester_2" ? 2 : 1);
}

function revalidateViews() {
  revalidatePath("/strategy");
  revalidatePath("/analytics");
  revalidatePath("/analytics/[subject]", "page");
}

export async function generateWeaknessRecommendations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: exams }, { data: logs }, { data: tasks }, { data: schedules }, { data: goals }] =
    await Promise.all([
      supabase
        .from("exams")
        .select(`subjects ( id, name ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage )`)
        .eq("user_id", user.id),
      supabase
        .from("study_logs")
        .select(`study_date, duration_minutes, concentration_level, subjects ( id, name )`)
        .eq("user_id", user.id)
        .order("study_date", { ascending: false })
        .limit(160),
      supabase
        .from("study_tasks")
        .select(`due_date, is_completed, subjects ( id, name )`)
        .eq("user_id", user.id)
        .limit(160),
      supabase
        .from("schedules")
        .select(`event_type, start_date, is_completed, subjects ( id, name )`)
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .gte("start_date", today)
        .limit(120),
      supabase
        .from("subject_goals")
        .select(`target_score, subjects ( id, name )`)
        .eq("user_id", user.id),
    ]);

  const subjectMap = new Map<string, { name: string; grades: GradePoint[] }>();
  for (const row of ((exams ?? []) as ExamRow[])) {
    const subject = getOne(row.subjects);
    const semester = getOne(row.semesters);
    const percentage = row.grade_records[0]?.percentage;
    if (!subject || !semester || percentage == null) continue;
    if (!subjectMap.has(subject.id)) subjectMap.set(subject.id, { name: subject.name, grades: [] });
    subjectMap.get(subject.id)!.grades.push({
      percentage: Number(percentage),
      semOrder: semOrder(semester.year, semester.semester_type as SemesterType),
    });
  }

  if (subjectMap.size === 0) return { error: "성적 기록이 있어야 취약점 리포트를 만들 수 있습니다." };

  const goalBySubject = new Map<string, number>();
  for (const row of ((goals ?? []) as GoalRow[])) {
    const subject = getOne(row.subjects);
    if (subject && row.target_score != null) goalBySubject.set(subject.id, Number(row.target_score));
  }

  const logStats = new Map<string, { study7m: number; concentrationSum: number; concentrationCount: number }>();
  for (const row of ((logs ?? []) as StudyLogRow[])) {
    const subject = getOne(row.subjects);
    if (!subject) continue;
    const days = daysSince(row.study_date);
    if (days < 0 || days > 14) continue;
    if (!logStats.has(subject.id)) logStats.set(subject.id, { study7m: 0, concentrationSum: 0, concentrationCount: 0 });
    const stat = logStats.get(subject.id)!;
    if (days <= 7) stat.study7m += row.duration_minutes ?? 0;
    if (row.concentration_level != null) {
      stat.concentrationSum += row.concentration_level;
      stat.concentrationCount += 1;
    }
  }

  const taskStats = new Map<string, { pending: number; dueSoon: number; overdue: number }>();
  for (const row of ((tasks ?? []) as StudyTaskRow[])) {
    const subject = getOne(row.subjects);
    if (!subject || row.is_completed) continue;
    if (!taskStats.has(subject.id)) taskStats.set(subject.id, { pending: 0, dueSoon: 0, overdue: 0 });
    const stat = taskStats.get(subject.id)!;
    stat.pending += 1;
    if (!row.due_date) continue;
    const days = daysUntil(row.due_date);
    if (days < 0) stat.overdue += 1;
    else if (days <= 7) stat.dueSoon += 1;
  }

  const examDaysBySubject = new Map<string, number>();
  for (const row of ((schedules ?? []) as ScheduleRow[])) {
    if (row.is_completed || (row.event_type !== "exam" && row.event_type !== "mock_exam")) continue;
    const subject = getOne(row.subjects);
    if (!subject) continue;
    const days = daysUntil(row.start_date);
    if (days < 0 || days > 14) continue;
    const current = examDaysBySubject.get(subject.id);
    if (current == null || days < current) examDaysBySubject.set(subject.id, days);
  }

  const signals: WeaknessSignal[] = [...subjectMap.entries()].map(([subjectId, subject]) => {
    const metrics = computeMetrics(subject.name, subject.grades);
    const risk = computeRisk(metrics);
    const log = logStats.get(subjectId);
    const task = taskStats.get(subjectId);
    const targetScore = goalBySubject.get(subjectId) ?? null;
    const targetGap = targetScore == null ? null : Math.round((targetScore - metrics.latestScore) * 10) / 10;
    return {
      subjectId,
      subject: subject.name,
      average: metrics.average,
      latestScore: metrics.latestScore,
      recentDelta: metrics.recentDelta,
      riskLevel: risk.riskLevel,
      riskReason: risk.reasons[0] ?? "",
      targetScore,
      targetGap,
      study7m: log?.study7m ?? 0,
      concentration14:
        log && log.concentrationCount > 0
          ? Math.round((log.concentrationSum / log.concentrationCount) * 10) / 10
          : null,
      pendingTasks: task?.pending ?? 0,
      dueSoonTasks: task?.dueSoon ?? 0,
      overdueTasks: task?.overdue ?? 0,
      examDaysLeft: examDaysBySubject.get(subjectId) ?? null,
    };
  });

  const weaknesses = signals.map(buildWeaknessDraft).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (weaknesses.length === 0) return { error: "현재 생성할 취약점 리포트가 없습니다." };

  await supabase.from("learning_recommendations").delete().eq("user_id", user.id);
  await supabase.from("weakness_reports").delete().eq("user_id", user.id);

  const { data: insertedWeaknesses, error: weaknessError } = await supabase
    .from("weakness_reports")
    .insert(
      weaknesses.map((weakness) => ({
        user_id: user.id,
        subject_id: weakness.subjectId,
        weakness_type: weakness.weaknessType,
        title: weakness.title,
        description: weakness.description,
        severity: weakness.severity,
        evidence: weakness.evidence,
      })),
    )
    .select("id, subject_id, title");

  if (weaknessError) return { error: `취약점 저장 중 오류가 발생했습니다: ${weaknessError.message}` };

  const weaknessIdByKey = new Map<string, string>();
  for (const row of insertedWeaknesses ?? []) {
    weaknessIdByKey.set(`${row.subject_id}:${row.title}`, row.id);
  }

  const recommendations = weaknesses.map(buildRecommendationDraft);
  const { error: recommendationError } = await supabase.from("learning_recommendations").insert(
    recommendations.map((recommendation) => ({
      user_id: user.id,
      subject_id: recommendation.subjectId,
      weakness_report_id: weaknessIdByKey.get(`${recommendation.subjectId}:${recommendation.weaknessTitle}`) ?? null,
      recommendation_type: recommendation.recommendationType,
      title: recommendation.title,
      description: recommendation.description,
      priority: recommendation.priority,
    })),
  );

  if (recommendationError) {
    return { error: `추천 저장 중 오류가 발생했습니다: ${recommendationError.message}` };
  }

  revalidateViews();
  return { success: true, weaknessCount: weaknesses.length, recommendationCount: recommendations.length };
}
