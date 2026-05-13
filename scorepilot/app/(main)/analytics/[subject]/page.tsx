import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatSemester, type SemesterType, type ExamType } from "@/lib/constants/grades";
import GradeChart from "@/components/analytics/GradeChart";
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
  high:         { label: "위험",      cls: "bg-red-100 text-red-700" },
  medium:       { label: "주의",      cls: "bg-yellow-100 text-yellow-700" },
  low:          { label: "안정",      cls: "bg-green-100 text-green-700" },
  insufficient: { label: "데이터 부족", cls: "bg-gray-100 text-gray-500" },
};

const TREND_ICON: Record<string, string> = {
  up: "↑", down: "↓", stable: "→", new: "•",
};
const TREND_COLOR: Record<string, string> = {
  up: "text-green-600", down: "text-red-500", stable: "text-muted-foreground", new: "text-muted-foreground",
};

type StudyLogRow = {
  id: string;
  subject_id: string | null;
  study_date: string;
  duration_minutes: number | null;
  difficulty: string | null;
  concentration_level: number | null;
  content: string | null;
  subjects: { name: string } | { name: string }[] | null;
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
  subjects: { name: string } | { name: string }[] | null;
};

type SubjectRow = {
  id: string;
  name: string;
};

function formatStudyDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "-";
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
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
  const subject = decodeURIComponent(encodedSubject);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 해당 과목의 성적/학습 데이터 조회
  const [
    { data: rawRows },
    { data: studyLogRows },
    { data: studyTaskRows },
    { data: subjectRows },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id, exam_type,
        subjects ( name ),
        semesters!exam_semester ( year, semester_type ),
        grade_records ( score, max_score, percentage )
      `)
      .eq("user_id", user!.id),
    supabase
      .from("study_logs")
      .select(`id, subject_id, study_date, duration_minutes, difficulty, concentration_level, content, subjects ( name )`)
      .eq("user_id", user!.id)
      .order("study_date", { ascending: false })
      .limit(20),
    supabase
      .from("study_tasks")
      .select(`id, subject_id, title, task_type, due_date, priority, is_completed, memo, subjects ( name )`)
      .eq("user_id", user!.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  const grades = ((rawRows ?? []) as {
    id: string;
    exam_type: string;
    subjects: { name: string } | { name: string }[] | null;
    semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
    grade_records: { score: number; max_score: number; percentage: number }[];
  }[]).flatMap((r) => {
    const subName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (subName !== subject) return [];
    const grade = r.grade_records[0];
    if (!grade) return [];
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    const semOrder = sem.year * 10 + (sem.semester_type === "semester_2" ? 2 : 1);
    return [{
      examId: r.id,
      examType: r.exam_type as ExamType,
      score: grade.score,
      maxScore: grade.max_score,
      percentage: grade.percentage,
      semester: formatSemester(sem.year, sem.semester_type as SemesterType),
      semOrder,
    }];
  }).sort((a, b) => a.semOrder - b.semOrder);

  if (grades.length === 0) notFound();

  const subjectNames = [
    ...new Set(
      ((rawRows ?? []) as {
        subjects: { name: string } | { name: string }[] | null;
      }[])
        .map((r) => (Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name))
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, "ko"));
  const subjectOptions = [...new Map(
    ((subjectRows ?? []) as SubjectRow[]).map((subject) => [subject.name, subject]),
  ).values()];

  // ── 분석 계산 ────────────────────────────────────────────────
  const gradePoints: GradePoint[] = grades.map((g) => ({
    percentage: g.percentage,
    semOrder: g.semOrder,
  }));

  const metrics = computeMetrics(subject, gradePoints);
  const risk = computeRisk(metrics);
  const strategy = computeStrategy(metrics, risk);
  const prediction = computePrediction(gradePoints);

  // ── 차트 데이터 (이 과목만) ──────────────────────────────────
  const semesterSet = [...new Set(grades.map((g) => g.semester))];
  const chartData = semesterSet.map((sem) => {
    const g = grades.find((r) => r.semester === sem);
    return { semester: sem, [subject]: g?.percentage ?? null };
  });

  // ── 최근 공부 기록 ────────────────────────────────────────────
  const recentStudyLogs = ((studyLogRows ?? []) as StudyLogRow[])
    .flatMap((r) => {
      const subjectName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
      if (subjectName !== subject) return [];
      return [{ ...r, subject: subjectName }];
    })
    .slice(0, 10);

  const pendingStudyTasks = ((studyTaskRows ?? []) as StudyTaskRow[])
    .flatMap((r) => {
      const subjectName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
      if (subjectName !== subject) return [];
      return [{ ...r, subject: subjectName }];
    })
    .slice(0, 3);

  const riskCfg = RISK_CONFIG[risk.riskLevel];
  const deltaColor =
    metrics.recentDelta === null ? "text-muted-foreground"
    : metrics.recentDelta > 0 ? "text-green-600"
    : metrics.recentDelta < 0 ? "text-red-500"
    : "text-muted-foreground";

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/analytics"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 분석
          </Link>
          <h1 className="text-2xl font-bold mt-1">{subject}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {grades[grades.length - 1]?.semester} 기준
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-sm px-3 py-1 rounded-full font-medium", riskCfg.cls)}>
            {riskCfg.label}
          </span>
          <AnalysisModeSelect subjects={subjectNames} currentSubject={subject} />
        </div>
      </div>

      {/* 2컬럼 레이아웃 */}
      <div className="grid grid-cols-[3fr_2fr] gap-6 items-start">

        {/* ── 왼쪽: 성적 추이 + 분석 ── */}
        <div className="space-y-6">

          {/* 성적 추이 */}
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">성적 추이</h2>
              <span className="text-sm text-muted-foreground">
                평균 <span className="font-semibold text-foreground">{metrics.average}%</span>
              </span>
            </div>
            <GradeChart data={chartData} subjects={[subject]} />
          </div>

          {/* 과목 분석 */}
          <div className="rounded-2xl border bg-white p-6 space-y-5">
            <h2 className="text-base font-semibold">과목 분석</h2>

            {/* 수치 그리드 */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">평균</p>
                <p className="text-xl font-bold">{metrics.average}%</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">최근 점수</p>
                <p className="text-xl font-bold">{metrics.latestScore}%</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">최근 변화</p>
                <p className={cn("text-xl font-bold", deltaColor)}>
                  {metrics.recentDelta === null
                    ? "—"
                    : `${metrics.recentDelta > 0 ? "+" : ""}${metrics.recentDelta}점`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">추세</span>
                  <span className={cn("font-semibold", TREND_COLOR[metrics.trend])}>
                    {TREND_ICON[metrics.trend]} {metrics.trend === "up" ? "상승" : metrics.trend === "down" ? "하락" : metrics.trend === "stable" ? "유지" : "신규"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">변동성</span>
                  <span className="font-medium">{metrics.volatility}점</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">기록 수</span>
                  <span className="font-medium">{metrics.count}회</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">위험도</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", riskCfg.cls)}>
                    {riskCfg.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">우선순위</span>
                  <span className="font-medium">{strategy.priority}순위</span>
                </div>
              </div>
            </div>

            {/* 위험 사유 */}
            {risk.reasons.length > 0 && (
              <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {risk.reasons[0]}
              </div>
            )}

            {/* 추천 전략 */}
            <div className="rounded-lg border-l-4 border-primary/40 bg-primary/5 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">추천 전략</p>
              <p className="text-sm font-medium">{strategy.action}</p>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 공부 기록 + AI 예측 ── */}
        <div className="space-y-6 sticky top-24">

          {/* 공부 기록 */}
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">최근 공부 기록</h2>
              <StudyLogForm subjects={subjectOptions} defaultSubjectName={subject} />
            </div>
            {recentStudyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                이 과목의 공부 기록을 추가하면 여기에 표시됩니다.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 font-medium">날짜</th>
                    <th className="pb-2 font-medium">과목</th>
                    <th className="pb-2 font-medium text-right">공부 시간</th>
                    <th className="pb-2 font-medium text-right">난이도</th>
                    <th className="pb-2 font-medium text-right">집중도</th>
                    <th className="pb-2 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudyLogs.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {formatStudyDate(r.study_date)}
                      </td>
                      <td className="py-2 font-medium">{r.subject}</td>
                      <td className="py-2 text-right text-xs">
                        {formatDuration(r.duration_minutes)}
                      </td>
                      <td className="py-2 text-right text-xs">
                        {r.difficulty ? difficultyLabels[r.difficulty] ?? r.difficulty : "-"}
                      </td>
                      <td className="py-2 text-right text-xs font-semibold">
                        {r.concentration_level != null ? `${r.concentration_level}/5` : "-"}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-1">
                          <StudyLogForm
                            subjects={subjectOptions}
                            defaultSubjectName={subject}
                            triggerLabel="수정"
                            log={{
                              id: r.id,
                              subjectId: r.subject_id,
                              studyDate: r.study_date,
                              durationMinutes: r.duration_minutes,
                              difficulty: r.difficulty,
                              concentrationLevel: r.concentration_level,
                              content: r.content,
                            }}
                          />
                          <StudyLogDeleteButton logId={r.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pendingStudyTasks.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">진행 중 할 일</p>
                  <StudyTaskForm subjects={subjectOptions} defaultSubjectName={subject} />
                </div>
                <div className="space-y-2">
                  {pendingStudyTasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate">{task.title}</p>
                        <p className="text-muted-foreground">
                          {task.priority ? priorityLabels[task.priority] ?? task.priority : "우선순위 없음"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StudyTaskForm
                          subjects={subjectOptions}
                          defaultSubjectName={subject}
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
            )}
            {pendingStudyTasks.length === 0 && (
              <div className="mt-4 border-t pt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">진행 중인 공부 할 일이 없습니다.</p>
                <StudyTaskForm subjects={subjectOptions} defaultSubjectName={subject} />
              </div>
            )}
          </div>

          {/* AI 예측 */}
          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">AI 성적 예측</h2>
            {prediction ? (
              <>
                <div className="flex items-end gap-3">
                  <span className={cn(
                    "text-4xl font-bold",
                    prediction.predictedScore >= 80 ? "text-green-600"
                    : prediction.predictedScore >= 60 ? "text-yellow-600"
                    : "text-red-500"
                  )}>
                    {prediction.predictedScore}%
                  </span>
                  {metrics.average !== null && (
                    <span className={cn(
                      "text-sm font-medium pb-1",
                      prediction.predictedScore > metrics.average ? "text-green-600"
                      : prediction.predictedScore < metrics.average ? "text-red-500"
                      : "text-muted-foreground"
                    )}>
                      {prediction.predictedScore > metrics.average ? "+" : ""}
                      {(prediction.predictedScore - metrics.average).toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* 신뢰도 바 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>신뢰도</span>
                    <span>{Math.round(prediction.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${prediction.confidence * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {prediction.basis}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                성적 기록이 더 쌓이면 예측이 가능합니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
