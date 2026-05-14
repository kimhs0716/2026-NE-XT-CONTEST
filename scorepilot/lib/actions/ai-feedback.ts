"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type SemesterType } from "@/lib/constants/grades";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { computeStrategy } from "@/lib/analytics/strategy";
import { computePrediction } from "@/lib/analytics/prediction";
import { buildInsight } from "@/lib/analytics/insight-data";
import { buildFeedbackPrompt, type MockExamSummary, type StudyFeedbackContext } from "@/lib/ai/prompt";
import { generateFeedbackWithFallback } from "@/lib/ai/generate-feedback";
import type { GradePoint, SubjectInsight } from "@/lib/analytics/types";

export type AiFeedbackResponse = {
  feedback?: string;
  source?: "llm" | "fallback";
  isQuotaError?: boolean;
  error?: string;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntil(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / MS_PER_DAY);
}

function buildMockExamSummary(
  rows: {
    exam_year: number;
    exam_month: number;
    subject: string;
    raw_score: number | null;
    grade: number | null;
    target_score: number | null;
  }[],
): MockExamSummary | null {
  if (rows.length === 0) return null;

  const latest = rows.reduce((best, row) => {
    const bestOrder = best.exam_year * 100 + best.exam_month;
    const rowOrder = row.exam_year * 100 + row.exam_month;
    return rowOrder > bestOrder ? row : best;
  }, rows[0]);
  const latestOrder = latest.exam_year * 100 + latest.exam_month;
  const latestRows = rows.filter((row) => row.exam_year * 100 + row.exam_month === latestOrder);
  const grades = latestRows.map((row) => row.grade).filter((grade): grade is number => grade != null);
  const averageGrade =
    grades.length > 0
      ? Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 10) / 10
      : null;

  const weakSubjects = latestRows
    .filter((row) => (row.grade != null && row.grade >= 4) || (row.target_score != null && row.raw_score != null && row.target_score - row.raw_score >= 10))
    .sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0))
    .map((row) => row.subject)
    .slice(0, 3);

  const targetGaps = latestRows
    .filter((row) => row.target_score != null && row.raw_score != null && row.target_score > row.raw_score)
    .sort((a, b) => (b.target_score! - b.raw_score!) - (a.target_score! - a.raw_score!))
    .slice(0, 3)
    .map((row) => `${row.subject}${row.target_score! - row.raw_score!}`);

  return {
    latestExam: `${latest.exam_year}-${String(latest.exam_month).padStart(2, "0")}`,
    averageGrade,
    weakSubjects,
    targetGaps,
  };
}

export async function generateAiFeedback(): Promise<AiFeedbackResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: rows },
    { data: studyLogs },
    { data: studyTasks },
    { data: goals },
    { data: schedules },
    { data: profileData },
    { data: mockExamRows },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(
        `subjects ( id, name ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage )`,
      )
      .eq("user_id", user.id),
    supabase
      .from("study_logs")
      .select(`study_date, duration_minutes, difficulty, concentration_level, content, subjects ( id, name )`)
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(30),
    supabase
      .from("study_tasks")
      .select(`priority, is_completed, subjects ( id, name )`)
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .limit(30),
    supabase
      .from("subject_goals")
      .select("target_score, subjects ( id, name )")
      .eq("user_id", user.id),
    supabase
      .from("schedules")
      .select("start_date, is_completed, subjects ( id, name )")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .gte("start_date", today)
      .limit(40),
    supabase
      .from("profiles")
      .select("school_level")
      .eq("id", user.id)
      .single(),
    supabase
      .from("mock_exam_records")
      .select("exam_year, exam_month, subject, raw_score, grade, target_score")
      .eq("user_id", user.id)
      .order("exam_year", { ascending: false })
      .order("exam_month", { ascending: false })
      .limit(24),
  ]);

  if (!rows?.length) return { error: "성적 데이터가 없습니다." };

  // 과목별 성적 집계
  const subjectMap = new Map<string, { name: string; grades: GradePoint[] }>();
  for (const r of rows) {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) continue;
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub) continue;
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) continue;
    const semOrder =
      sem.year * 10 +
      ((sem.semester_type as SemesterType) === "semester_2" ? 2 : 1);
    if (!subjectMap.has(sub.id))
      subjectMap.set(sub.id, { name: sub.name, grades: [] });
    subjectMap.get(sub.id)!.grades.push({ percentage: Number(pct), semOrder });
  }

  // 자체 수치 로직으로 분석 + 예측 (LLM 없이도 완성)
  const insights: SubjectInsight[] = [];
  for (const { name, grades } of subjectMap.values()) {
    const metrics = computeMetrics(name, grades);
    const risk = computeRisk(metrics);
    const strategy = computeStrategy(metrics, risk);
    const prediction = computePrediction(grades);
    if (!prediction) continue;
    insights.push(buildInsight(metrics, risk, strategy, prediction));
  }

  if (insights.length === 0) return { error: "분석할 데이터가 없습니다." };

  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );

  const studyMap = new Map<
    string,
    {
      subject: string;
      logCount: number;
      totalMinutes: number;
      concentrationSum: number;
      concentrationCount: number;
      hardLogCount: number;
      pendingTaskCount: number;
      highPriorityTaskCount: number;
      recentContents: string[];
      targetScore: number | null;
      upcomingScheduleCount: number;
      nearestScheduleDays: number | null;
      lastStudyDate: string | null;
    }
  >();

  function ensureStudyEntry(subjectId: string, subjectName: string) {
    if (!studyMap.has(subjectId)) {
      studyMap.set(subjectId, {
        subject: subjectName,
        logCount: 0,
        totalMinutes: 0,
        concentrationSum: 0,
        concentrationCount: 0,
        hardLogCount: 0,
        pendingTaskCount: 0,
        highPriorityTaskCount: 0,
        recentContents: [],
        targetScore: null,
        upcomingScheduleCount: 0,
        nearestScheduleDays: null,
        lastStudyDate: null,
      });
    }
    return studyMap.get(subjectId)!;
  }

  for (const r of (studyLogs ?? []) as {
    study_date: string | null;
    duration_minutes: number | null;
    difficulty: string | null;
    concentration_level: number | null;
    content: string | null;
    subjects: { id: string; name: string } | { id: string; name: string }[] | null;
  }[]) {
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub) continue;
    const entry = ensureStudyEntry(sub.id, sub.name);
    entry.logCount += 1;
    entry.totalMinutes += r.duration_minutes ?? 0;
    if (!entry.lastStudyDate && r.study_date) entry.lastStudyDate = r.study_date;
    if (r.concentration_level != null) {
      entry.concentrationSum += r.concentration_level;
      entry.concentrationCount += 1;
    }
    if (r.difficulty === "hard") entry.hardLogCount += 1;
    if (r.content && entry.recentContents.length < 2) {
      entry.recentContents.push(r.content);
    }
  }

  for (const r of (studyTasks ?? []) as {
    priority: string | null;
    is_completed: boolean;
    subjects: { id: string; name: string } | { id: string; name: string }[] | null;
  }[]) {
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub) continue;
    const entry = ensureStudyEntry(sub.id, sub.name);
    entry.pendingTaskCount += 1;
    if (r.priority === "high") entry.highPriorityTaskCount += 1;
  }

  for (const r of (goals ?? []) as {
    target_score: number | null;
    subjects: { id: string; name: string } | { id: string; name: string }[] | null;
  }[]) {
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub || r.target_score == null) continue;
    ensureStudyEntry(sub.id, sub.name).targetScore = Number(r.target_score);
  }

  for (const r of (schedules ?? []) as {
    start_date: string;
    is_completed: boolean;
    subjects: { id: string; name: string } | { id: string; name: string }[] | null;
  }[]) {
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub) continue;
    const daysLeft = daysUntil(r.start_date);
    if (daysLeft < 0 || daysLeft > 21) continue;
    const entry = ensureStudyEntry(sub.id, sub.name);
    entry.upcomingScheduleCount += 1;
    if (entry.nearestScheduleDays === null || daysLeft < entry.nearestScheduleDays) {
      entry.nearestScheduleDays = daysLeft;
    }
  }

  for (const [subjectId, { name }] of subjectMap.entries()) {
    ensureStudyEntry(subjectId, name);
  }

  const studyContexts: StudyFeedbackContext[] = [...studyMap.values()].map((entry) => {
    const latestScore = insights.find((insight) => insight.subject === entry.subject)?.latestScore ?? null;
    return {
      subject: entry.subject,
      targetScore: entry.targetScore,
      targetGap:
        entry.targetScore == null || latestScore == null
          ? null
          : Math.round((entry.targetScore - latestScore) * 10) / 10,
      logCount: entry.logCount,
      totalMinutes: entry.totalMinutes,
      averageConcentration:
        entry.concentrationCount > 0
          ? Math.round((entry.concentrationSum / entry.concentrationCount) * 10) / 10
          : null,
      hardLogCount: entry.hardLogCount,
      pendingTaskCount: entry.pendingTaskCount,
      highPriorityTaskCount: entry.highPriorityTaskCount,
      upcomingScheduleCount: entry.upcomingScheduleCount,
      nearestScheduleDays: entry.nearestScheduleDays,
      daysSinceLastStudy: (() => {
        if (!entry.lastStudyDate) return null;
        const [y, m, d] = entry.lastStudyDate.split("-").map(Number);
        return Math.round((todayMs - Date.UTC(y, m - 1, d)) / MS_PER_DAY);
      })(),
      recentContents: entry.recentContents,
    };
  });

  const schoolLevel = profileData?.school_level === "high" ? "high" : profileData?.school_level === "middle" ? "middle" : null;
  const mockExamSummary = schoolLevel === "high" ? buildMockExamSummary(mockExamRows ?? []) : null;
  const prompt = buildFeedbackPrompt(insights, studyContexts, schoolLevel, mockExamSummary);
  const result = await generateFeedbackWithFallback(prompt, insights, studyContexts);

  await supabase.from("analysis_reports").insert({
    user_id: user.id,
    report_type: "overall",
    title: "AI 학습 피드백",
    summary: result.text,
    average_score:
      insights.length > 0
        ? Math.round(
            (insights.reduce((sum, insight) => sum + insight.average, 0) / insights.length) * 10,
          ) / 10
        : null,
    trend: "unknown",
  });

  revalidatePath("/analytics");

  return {
    feedback: result.text,
    source: result.source,
    isQuotaError: result.isQuotaError,
  };
}
