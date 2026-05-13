"use server";

import { createClient } from "@/lib/supabase/server";
import { type SemesterType } from "@/lib/constants/grades";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { computeStrategy } from "@/lib/analytics/strategy";
import { computePrediction } from "@/lib/analytics/prediction";
import { buildInsight } from "@/lib/analytics/insight-data";
import { buildFeedbackPrompt, type StudyFeedbackContext } from "@/lib/ai/prompt";
import { generateFeedbackWithFallback } from "@/lib/ai/generate-feedback";
import type { GradePoint } from "@/lib/analytics/types";

export type AiFeedbackResponse = {
  feedback?: string;
  source?: "llm" | "fallback";
  isQuotaError?: boolean;
  error?: string;
};

export async function generateAiFeedback(): Promise<AiFeedbackResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const [{ data: rows }, { data: studyLogs }, { data: studyTasks }] = await Promise.all([
    supabase
      .from("exams")
      .select(
        `subjects ( id, name ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage )`,
      )
      .eq("user_id", user.id),
    supabase
      .from("study_logs")
      .select(`duration_minutes, difficulty, concentration_level, content, subjects ( id, name )`)
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(30),
    supabase
      .from("study_tasks")
      .select(`priority, is_completed, subjects ( id, name )`)
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .limit(30),
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
  const insights = [];
  for (const { name, grades } of subjectMap.values()) {
    const metrics = computeMetrics(name, grades);
    const risk = computeRisk(metrics);
    const strategy = computeStrategy(metrics, risk);
    const prediction = computePrediction(grades);
    if (!prediction) continue;
    insights.push(buildInsight(metrics, risk, strategy, prediction));
  }

  if (insights.length === 0) return { error: "분석할 데이터가 없습니다." };

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
      });
    }
    return studyMap.get(subjectId)!;
  }

  for (const r of (studyLogs ?? []) as {
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

  for (const [subjectId, { name }] of subjectMap.entries()) {
    ensureStudyEntry(subjectId, name);
  }

  const studyContexts: StudyFeedbackContext[] = [...studyMap.values()].map((entry) => ({
    subject: entry.subject,
    logCount: entry.logCount,
    totalMinutes: entry.totalMinutes,
    averageConcentration:
      entry.concentrationCount > 0
        ? Math.round((entry.concentrationSum / entry.concentrationCount) * 10) / 10
        : null,
    hardLogCount: entry.hardLogCount,
    pendingTaskCount: entry.pendingTaskCount,
    highPriorityTaskCount: entry.highPriorityTaskCount,
    recentContents: entry.recentContents,
  }));

  // LLM은 문장 생성 보조 역할 — 실패해도 fallback 반환
  const prompt = buildFeedbackPrompt(insights, studyContexts);
  const result = await generateFeedbackWithFallback(prompt, insights, studyContexts);

  return {
    feedback: result.text,
    source: result.source,
    isQuotaError: result.isQuotaError,
  };
}
