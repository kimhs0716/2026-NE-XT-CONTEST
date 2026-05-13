import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatSemester, type SemesterType, type ExamType } from "@/lib/constants/grades";
import AnalysisGradeTrendChart, { type GradeTrendSourceRow } from "@/components/analytics/AnalysisGradeTrendChart";
import AnalysisModeSelect from "@/components/analytics/AnalysisModeSelect";
import StudyLogForm from "@/components/analytics/StudyLogForm";
import StudyLogDeleteButton from "@/components/analytics/StudyLogDeleteButton";
import StudyTaskForm from "@/components/analytics/StudyTaskForm";
import StudyTaskActions from "@/components/analytics/StudyTaskActions";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { computeStrategy } from "@/lib/analytics/strategy";
import { computePrediction } from "@/lib/analytics/prediction";
import type { GradePoint } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

const RISK_CONFIG = {
  high: { label: "위험", cls: "bg-red-100 text-red-700" },
  medium: { label: "주의", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "안정", cls: "bg-green-100 text-green-700" },
  insufficient: { label: "데이터 부족", cls: "bg-gray-100 text-gray-500" },
};

const TREND_LABEL: Record<string, string> = {
  up: "상승",
  down: "하락",
  stable: "유지",
  new: "신규",
};

const TREND_COLOR: Record<string, string> = {
  up: "text-green-600",
  down: "text-red-500",
  stable: "text-muted-foreground",
  new: "text-muted-foreground",
};

type StudyLogRow = {
  id: string;
  subject_id: string | null;
  study_date: string;
  duration_minutes: number | null;
  difficulty: string | null;
  concentration_level: number | null;
  content: string | null;
  subjects: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
};

type StudyTaskRow = {
  id: string;
  subject_id: string | null;
  title: string;
  task_type: string | null;
  due_date: string | null;
  priority: string | null;
  is_completed: boolean;
  memo: string | null;
  subjects: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
};

type SubjectRow = {
  id: string;
  name: string;
  category: string | null;
};

function resolveCategory(subject: { name: string; category: string | null } | undefined): string {
  return subject?.category?.trim() || "미분류";
}

function withTrendOrder<T extends { semOrder: number; createdAt: string }>(
  rows: T[],
): (T & { trendOrder: number })[] {
  return [...rows]
    .sort((a, b) => a.semOrder - b.semOrder || a.createdAt.localeCompare(b.createdAt))
    .map((row, index) => ({ ...row, trendOrder: row.semOrder * 1000 + index }));
}

function formatStudyDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "-";
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

const difficultyLabels: Record<string, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
};

const priorityLabels: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export default async function SubjectAnalyticsPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: encodedSubject } = await params;
  const category = decodeURIComponent(encodedSubject);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: rawRows },
    { data: studyLogRows },
    { data: studyTaskRows },
    { data: subjectRows },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id, exam_type, created_at,
        subjects ( name, category ),
        semesters!exam_semester ( year, semester_type ),
        grade_records ( score, max_score, percentage, grade_level )
      `)
      .eq("user_id", user!.id),
    supabase
      .from("study_logs")
      .select("id, subject_id, study_date, duration_minutes, difficulty, concentration_level, content, subjects ( name, category )")
      .eq("user_id", user!.id)
      .order("study_date", { ascending: false })
      .limit(20),
    supabase
      .from("study_tasks")
      .select("id, subject_id, title, task_type, due_date, priority, is_completed, memo, subjects ( name, category )")
      .eq("user_id", user!.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("subjects")
      .select("id, name, category")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  const grades = ((rawRows ?? []) as {
    id: string;
    exam_type: string;
    created_at: string;
    subjects: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
    semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
    grade_records: { score: number; max_score: number; percentage: number; grade_level: string | null }[];
  }[]).flatMap((row) => {
    const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
    if (!subject?.name || resolveCategory(subject) !== category) return [];
    const grade = row.grade_records[0];
    if (!grade) return [];
    const semester = Array.isArray(row.semesters) ? row.semesters[0] : row.semesters;
    if (!semester) return [];
    const semOrder = semester.year * 10 + (semester.semester_type === "semester_2" ? 2 : 1);
    return [{
      examId: row.id,
      subjectName: subject.name,
      examType: row.exam_type as ExamType,
      score: grade.score,
      maxScore: grade.max_score,
      percentage: grade.percentage,
      gradeLevel: grade.grade_level,
      semesterKey: `${semester.year}-${semester.semester_type as SemesterType}`,
      semester: formatSemester(semester.year, semester.semester_type as SemesterType),
      semOrder,
      createdAt: row.created_at,
    }];
  });

  if (grades.length === 0) notFound();

  const subjectNames = [
    ...new Set(
      ((rawRows ?? []) as {
        subjects: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
      }[])
        .map((row) => resolveCategory(Array.isArray(row.subjects) ? row.subjects[0] : row.subjects ?? undefined))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "ko"));

  const subjectOptions = [...new Map(
    ((subjectRows ?? []) as SubjectRow[]).map((subject) => [subject.name, subject]),
  ).values()];
  const categorySubjectOptions = subjectOptions.filter((subject) => resolveCategory(subject) === category);
  const defaultSubjectName = categorySubjectOptions[0]?.name;

  const orderedGrades = withTrendOrder(grades);
  const gradePoints: GradePoint[] = orderedGrades.map((grade) => ({
    percentage: grade.percentage,
    semOrder: grade.trendOrder,
  }));

  const metrics = computeMetrics(category, gradePoints);
  const risk = computeRisk(metrics);
  const strategy = computeStrategy(metrics, risk);
  const prediction = computePrediction(gradePoints);

  const trendRows: GradeTrendSourceRow[] = grades.map((grade) => ({
    subjectName: grade.subjectName,
    category,
    semesterKey: grade.semesterKey,
    semesterLabel: grade.semester,
    semOrder: grade.semOrder,
    examType: grade.examType,
    gradeLevel: grade.gradeLevel,
    createdAt: grade.createdAt,
  }));

  const recentStudyLogs = ((studyLogRows ?? []) as StudyLogRow[])
    .flatMap((row) => {
      const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const subjectName = subject?.name;
      if (!subjectName || resolveCategory(subject) !== category) return [];
      return [{ ...row, subject: subjectName }];
    })
    .slice(0, 10);

  const pendingStudyTasks = ((studyTaskRows ?? []) as StudyTaskRow[])
    .flatMap((row) => {
      const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const subjectName = subject?.name;
      if (!subjectName || resolveCategory(subject) !== category) return [];
      return [{ ...row, subject: subjectName }];
    })
    .slice(0, 3);

  const riskCfg = RISK_CONFIG[risk.riskLevel];
  const deltaColor =
    metrics.recentDelta === null ? "text-muted-foreground"
    : metrics.recentDelta > 0 ? "text-green-600"
    : metrics.recentDelta < 0 ? "text-red-500"
    : "text-muted-foreground";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/analytics" className="text-sm text-muted-foreground hover:text-foreground">
            ← 분석
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{category}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {grades[grades.length - 1]?.semester} 기준
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", riskCfg.cls)}>
            {riskCfg.label}
          </span>
          <AnalysisModeSelect subjects={subjectNames} currentSubject={category} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="min-w-0 space-y-6">
          <div className="min-w-0 rounded-2xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">성적 추이</h2>
              <span className="text-sm text-muted-foreground">
                평균 <span className="font-semibold text-foreground">{metrics.average}%</span>
              </span>
            </div>
            <AnalysisGradeTrendChart rows={trendRows} categories={[category]} />
          </div>

          <div className="min-w-0 space-y-5 rounded-2xl border bg-white p-6">
            <h2 className="text-base font-semibold">분류 분석</h2>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="mb-1 text-xs text-muted-foreground">평균</p>
                <p className="text-xl font-bold">{metrics.average}%</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="mb-1 text-xs text-muted-foreground">최근 점수</p>
                <p className="text-xl font-bold">{metrics.latestScore}%</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="mb-1 text-xs text-muted-foreground">최근 변화</p>
                <p className={cn("text-xl font-bold", deltaColor)}>
                  {metrics.recentDelta === null
                    ? "-"
                    : `${metrics.recentDelta > 0 ? "+" : ""}${metrics.recentDelta}%`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">추세</span>
                  <span className={cn("font-semibold", TREND_COLOR[metrics.trend])}>
                    {TREND_LABEL[metrics.trend]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">변동성</span>
                  <span className="font-medium">{metrics.volatility}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">기록 수</span>
                  <span className="font-medium">{metrics.count}회</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">위험도</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", riskCfg.cls)}>
                    {riskCfg.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">우선순위</span>
                  <span className="font-medium">{strategy.priority}순위</span>
                </div>
              </div>
            </div>

            {risk.reasons.length > 0 && (
              <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {risk.reasons[0]}
              </div>
            )}

            <div className="rounded-lg border-l-4 border-primary/40 bg-primary/5 px-4 py-3">
              <p className="mb-0.5 text-xs text-muted-foreground">추천 전략</p>
              <p className="text-sm font-medium">{strategy.action}</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6 xl:sticky xl:top-24">
          <div className="rounded-2xl border bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">최근 공부 기록</h2>
              <StudyLogForm subjects={categorySubjectOptions} defaultSubjectName={defaultSubjectName} />
            </div>
            {recentStudyLogs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                이 분류의 공부 기록을 추가하면 여기에 표시됩니다.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">날짜</th>
                    <th className="pb-2 font-medium">과목</th>
                    <th className="pb-2 text-right font-medium">공부 시간</th>
                    <th className="pb-2 text-right font-medium">난이도</th>
                    <th className="pb-2 text-right font-medium">집중도</th>
                    <th className="pb-2 text-right font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudyLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">
                        {formatStudyDate(log.study_date)}
                      </td>
                      <td className="py-2 font-medium">{log.subject}</td>
                      <td className="py-2 text-right text-xs">{formatDuration(log.duration_minutes)}</td>
                      <td className="py-2 text-right text-xs">
                        {log.difficulty ? difficultyLabels[log.difficulty] ?? log.difficulty : "-"}
                      </td>
                      <td className="py-2 text-right text-xs font-semibold">
                        {log.concentration_level != null ? `${log.concentration_level}/5` : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          <StudyLogForm
                            subjects={categorySubjectOptions}
                            defaultSubjectName={log.subject}
                            triggerLabel="수정"
                            log={{
                              id: log.id,
                              subjectId: log.subject_id,
                              studyDate: log.study_date,
                              durationMinutes: log.duration_minutes,
                              difficulty: log.difficulty,
                              concentrationLevel: log.concentration_level,
                              content: log.content,
                            }}
                          />
                          <StudyLogDeleteButton logId={log.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {pendingStudyTasks.length > 0 ? (
              <div className="mt-4 border-t pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">진행 중인 할 일</p>
                  <StudyTaskForm subjects={categorySubjectOptions} defaultSubjectName={defaultSubjectName} />
                </div>
                <div className="space-y-2">
                  {pendingStudyTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate">{task.title}</p>
                        <p className="text-muted-foreground">
                          {task.priority ? priorityLabels[task.priority] ?? task.priority : "우선순위 없음"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StudyTaskForm
                          subjects={categorySubjectOptions}
                          defaultSubjectName={task.subject}
                          triggerLabel="수정"
                          task={{
                            id: task.id,
                            subjectId: task.subject_id,
                            title: task.title,
                            taskType: task.task_type,
                            dueDate: task.due_date,
                            priority: task.priority,
                            memo: task.memo,
                          }}
                        />
                        <StudyTaskActions taskId={task.id} isCompleted={task.is_completed} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <p className="text-xs text-muted-foreground">진행 중인 공부 할 일이 없습니다.</p>
                <StudyTaskForm subjects={categorySubjectOptions} defaultSubjectName={defaultSubjectName} />
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border bg-white p-6">
            <h2 className="text-base font-semibold">AI 성적 예측</h2>
            {prediction ? (
              <>
                <div className="flex items-end gap-3">
                  <span className={cn(
                    "text-4xl font-bold",
                    prediction.predictedScore >= 80 ? "text-green-600"
                    : prediction.predictedScore >= 60 ? "text-yellow-600"
                    : "text-red-500",
                  )}>
                    {prediction.predictedScore}%
                  </span>
                  {metrics.average !== null && (
                    <span className={cn(
                      "pb-1 text-sm font-medium",
                      prediction.predictedScore > metrics.average ? "text-green-600"
                      : prediction.predictedScore < metrics.average ? "text-red-500"
                      : "text-muted-foreground",
                    )}>
                      {prediction.predictedScore > metrics.average ? "+" : ""}
                      {(prediction.predictedScore - metrics.average).toFixed(1)}%
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>신뢰도</span>
                    <span>{Math.round(prediction.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${prediction.confidence * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {prediction.basis}
                </p>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                성적 기록이 더 쌓이면 예측할 수 있습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
