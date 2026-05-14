import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { categoryOrder, formatSemester, type SemesterType } from "@/lib/constants/grades";
import GradeChart from "@/components/analytics/GradeChart";
import PredictionSection from "@/components/analytics/PredictionSection";
import SubjectAnalysisCard from "@/components/analytics/SubjectAnalysisCard";
import AiFeedbackCard from "@/components/analytics/AiFeedbackCard";
import AnalysisModeSelect from "@/components/analytics/AnalysisModeSelect";
import StudyLogForm from "@/components/analytics/StudyLogForm";
import StudyLogDeleteButton from "@/components/analytics/StudyLogDeleteButton";
import StudyTaskForm from "@/components/analytics/StudyTaskForm";
import StudyTaskActions from "@/components/analytics/StudyTaskActions";
import { computeMetrics } from "@/lib/analytics/metrics";
import { computeRisk } from "@/lib/analytics/risk";
import { computeStrategy } from "@/lib/analytics/strategy";
import type { GradePoint, SubjectAnalysis } from "@/lib/analytics/types";

type ExamRow = {
  exam_type: string;
  subjects: { name: string; category: string | null } | { name: string; category: string | null }[] | null;
  semesters:
    | { year: number; semester_type: string }
    | { year: number; semester_type: string }[]
    | null;
  grade_records: { percentage: number; score: number; max_score: number }[];
  created_at: string;
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

type AnalysisReportRow = {
  summary: string | null;
  created_at: string;
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

function semesterOrder(year: number, type: SemesterType): number {
  return year * 10 + (type === "semester_2" ? 2 : 1);
}

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

const subjectBadgePalettes = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

const difficultyBadgeClass: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  normal: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};

const concentrationBadgeClass: Record<number, string> = {
  1: "bg-rose-100 text-rose-700",
  2: "bg-orange-100 text-orange-700",
  3: "bg-amber-100 text-amber-700",
  4: "bg-lime-100 text-lime-700",
  5: "bg-emerald-100 text-emerald-700",
};

function subjectBadgeClass(subject: string): string {
  if (subject === "기타") return "bg-slate-100 text-slate-600";
  const hash = [...subject].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return subjectBadgePalettes[hash % subjectBadgePalettes.length];
}

const priorityLabels: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

function buildChartData(
  rows: { semester: string; semOrder: number; subject: string; percentage: number }[],
) {
  const subjects = [...new Set(rows.map((r) => r.subject))];
  const bySem = new Map<string, {
    semOrder: number;
    scores: Record<string, number | null>;
    scoreSums: Record<string, { sum: number; count: number }>;
  }>();
  for (const r of rows) {
    if (!bySem.has(r.semester)) {
      bySem.set(r.semester, {
        semOrder: r.semOrder,
        scores: Object.fromEntries(subjects.map((s) => [s, null])),
        scoreSums: Object.fromEntries(subjects.map((s) => [s, { sum: 0, count: 0 }])),
      });
    }
    const sem = bySem.get(r.semester)!;
    sem.scoreSums[r.subject].sum += r.percentage;
    sem.scoreSums[r.subject].count += 1;
    sem.scores[r.subject] = Math.round((sem.scoreSums[r.subject].sum / sem.scoreSums[r.subject].count) * 10) / 10;
  }
  const data = [...bySem.entries()]
    .sort(([, a], [, b]) => a.semOrder - b.semOrder)
    .map(([semester, { scores }]) => {
      const values = Object.values(scores).filter((v): v is number => v !== null);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        semester,
        ...scores,
        "전체 평균": avg !== null ? Math.round(avg * 10) / 10 : null,
      };
    });
  return { data, subjects };
}

function analysisName(subject: { name: string; category: string | null } | null | undefined): string | null {
  if (!subject?.name) return null;
  return subject.category || subject.name;
}

function sortAnalysisNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "ko");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function buildMockComparison(
  mockRows: MockExamRow[],
  subjectAnalysisList: SubjectAnalysis[],
) {
  if (mockRows.length === 0) return null;
  const latest = mockRows.reduce((best, row) => {
    const bestOrder = best.exam_year * 100 + best.exam_month;
    const rowOrder = row.exam_year * 100 + row.exam_month;
    return rowOrder > bestOrder ? row : best;
  }, mockRows[0]);
  const latestOrder = latest.exam_year * 100 + latest.exam_month;
  const latestRows = mockRows.filter((row) => row.exam_year * 100 + row.exam_month === latestOrder);
  const grades = latestRows.map((row) => row.grade).filter((grade): grade is number => grade != null);
  const averageGrade =
    grades.length > 0
      ? Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 10) / 10
      : null;
  const mockWeakSubjects = latestRows
    .filter((row) => (row.grade != null && row.grade >= 4) || (row.target_score != null && row.raw_score != null && row.target_score - row.raw_score >= 10))
    .map((row) => row.subject)
    .slice(0, 4);
  const schoolWeakSubjects = subjectAnalysisList
    .filter((item) => item.risk.riskLevel === "high" || item.risk.riskLevel === "medium")
    .map((item) => item.metrics.subject)
    .slice(0, 4);
  const overlap = mockWeakSubjects.filter((subject) => schoolWeakSubjects.includes(subject));

  return {
    label: `${latest.exam_year}년 ${latest.exam_month}월`,
    averageGrade,
    mockWeakSubjects,
    schoolWeakSubjects,
    overlap,
  };
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: rows },
    { data: predRows },
    { data: studyLogRows },
    { data: studyTaskRows },
    { data: subjectRows },
    { data: feedbackRows },
    { data: mockRows },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(
        `exam_type, subjects ( name, category ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage, score, max_score ), created_at`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("score_predictions")
      .select(`predicted_score, prediction_target, confidence, basis, created_at, subjects ( name, category )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("study_logs")
      .select(
        `id, subject_id, study_date, duration_minutes, difficulty, concentration_level, content, subjects ( name, category )`,
      )
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(20),
    supabase
      .from("study_tasks")
      .select(`id, subject_id, title, task_type, due_date, priority, is_completed, memo, subjects ( name, category )`)
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(40),
    supabase
      .from("subjects")
      .select("id, name, category")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("analysis_reports")
      .select("summary, created_at")
      .eq("user_id", user.id)
      .eq("report_type", "overall")
      .eq("title", "AI 학습 피드백")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("mock_exam_records")
      .select("exam_year, exam_month, subject, raw_score, percentile, grade, target_score")
      .eq("user_id", user.id)
      .order("exam_year", { ascending: false })
      .order("exam_month", { ascending: false })
      .limit(24),
  ]);

  // ── 유효 성적 데이터 ──────────────────────────────────────────
  const validRows = (rows as ExamRow[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const subject = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    const name = analysisName(subject);
    if (!name) return [];
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    const type = sem.semester_type as SemesterType;
    return [{
      subject: name,
      percentage: Number(pct),
      score: r.grade_records[0].score,
      maxScore: r.grade_records[0].max_score,
      semester: formatSemester(sem.year, type),
      semOrder: semesterOrder(sem.year, type),
    }];
  });

  const chart = buildChartData(validRows);
  const subjectNames = sortAnalysisNames([...chart.subjects]);
  const subjectOptions = [...new Map(
    ((subjectRows ?? []) as SubjectRow[]).map((subject) => [subject.name, subject]),
  ).values()];

  // ── 카테고리별 분석 ───────────────────────────────────────────
  const subjectGradeAccumulator = new Map<string, Map<number, { sum: number; count: number }>>();
  for (const r of validRows) {
    if (!subjectGradeAccumulator.has(r.subject)) subjectGradeAccumulator.set(r.subject, new Map());
    const subjectSemMap = subjectGradeAccumulator.get(r.subject)!;
    const existing = subjectSemMap.get(r.semOrder) ?? { sum: 0, count: 0 };
    existing.sum += r.percentage;
    existing.count += 1;
    subjectSemMap.set(r.semOrder, existing);
  }

  const subjectAnalysisList: SubjectAnalysis[] = [...subjectGradeAccumulator.entries()].map(
    ([subject, semMap]) => {
      const grades = [...semMap.entries()]
        .map(([semOrder, value]) => ({
          semOrder,
          percentage: Math.round((value.sum / value.count) * 10) / 10,
        }))
        .sort((a, b) => a.semOrder - b.semOrder);
      const metrics = computeMetrics(subject, grades);
      const risk = computeRisk(metrics);
      const strategy = computeStrategy(metrics, risk);
      return { metrics, risk, strategy };
    },
  );
  subjectAnalysisList.sort(
    (a, b) =>
      a.strategy.priority - b.strategy.priority ||
      a.metrics.subject.localeCompare(b.metrics.subject),
  );

  // ── 요약 수치 (차트 헤더용) ───────────────────────────────────
  const allAvgs = subjectAnalysisList.map((s) => s.metrics.average);
  const overallAvg =
    allAvgs.length > 0
      ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10
      : null;

  // ── 예측 데이터 ───────────────────────────────────────────────
  const predictions = (predRows ?? [])
    .map((r) => {
      const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
      return {
        subject_name: analysisName(sub) ?? "",
        predicted_score: Number(r.predicted_score),
        prediction_target: r.prediction_target,
        confidence: Number(r.confidence),
        basis: r.basis,
        created_at: r.created_at,
      };
    })
    .filter((p) => p.subject_name);

  const predictionMap = new Map<string, {
    subject_name: string;
    predicted_score: number;
    prediction_target: string;
    confidence: number;
    basis: string;
    created_at: string;
    count: number;
  }>();
  for (const prediction of predictions) {
    const existing = predictionMap.get(prediction.subject_name);
    if (!existing) {
      predictionMap.set(prediction.subject_name, { ...prediction, count: 1 });
    } else {
      existing.predicted_score += prediction.predicted_score;
      existing.confidence += prediction.confidence;
      existing.count += 1;
      if (new Date(prediction.created_at) > new Date(existing.created_at)) {
        existing.created_at = prediction.created_at;
      }
    }
  }
  const categoryPredictions = [...predictionMap.values()].map((prediction) => ({
    subject_name: prediction.subject_name,
    predicted_score: Math.round((prediction.predicted_score / prediction.count) * 10) / 10,
    prediction_target: prediction.count > 1 ? "카테고리 평균 예측" : prediction.prediction_target,
    confidence: Math.round((prediction.confidence / prediction.count) * 100) / 100,
    basis: prediction.count > 1 ? `${prediction.count}개 세부 과목 예측 평균` : prediction.basis,
    created_at: prediction.created_at,
  }));

  const subjectAvgs = subjectAnalysisList.map((s) => ({
    subject: s.metrics.subject,
    avg: s.metrics.average,
  }));

  const recentStudyLogs = ((studyLogRows ?? []) as StudyLogRow[]).map((r) => {
    const subject = analysisName(Array.isArray(r.subjects) ? r.subjects[0] : r.subjects);
    return { ...r, subject: subject ?? "기타" };
  });

  const allStudyTasks = ((studyTaskRows ?? []) as StudyTaskRow[]).map((r) => {
    const subject = analysisName(Array.isArray(r.subjects) ? r.subjects[0] : r.subjects);
    return { ...r, subject: subject ?? "기타" };
  });
  const pendingStudyTasks = allStudyTasks.filter((task) => !task.is_completed);
  const completedStudyTasks = allStudyTasks.filter((task) => task.is_completed).slice(0, 8);
  const savedFeedback = ((feedbackRows ?? []) as AnalysisReportRow[])[0];
  const mockComparison = buildMockComparison((mockRows ?? []) as MockExamRow[], subjectAnalysisList);

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">분석</h1>
          <p className="text-muted-foreground text-sm mt-1">
            카테고리별 성적 추이와 학습 피드백을 확인하세요
          </p>
        </div>
        <AnalysisModeSelect subjects={subjectNames} />
      </div>

      {/* 2컬럼 메인 레이아웃 */}
      <div className="grid grid-cols-[3fr_2fr] gap-6 items-start">

        {/* ── 왼쪽: 종합 성적 + 학습 피드백 ── */}
        <div className="space-y-6">

          {/* 종합 성적 (꺾은선 그래프) */}
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">종합 성적</h2>
              {overallAvg !== null && (
                <span className="text-sm text-muted-foreground">
                  전체 평균 <span className="font-semibold text-foreground">{overallAvg}점</span>
                </span>
              )}
            </div>
            <GradeChart data={chart.data} subjects={chart.subjects} />
          </div>

          {/* 학습 피드백 */}
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-base font-semibold mb-4">학습 피드백</h2>
            <div className="mb-4">
              <AiFeedbackCard
                initialFeedback={
                  savedFeedback?.summary
                    ? { text: savedFeedback.summary, createdAt: savedFeedback.created_at }
                    : null
                }
              />
            </div>
            {subjectAnalysisList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                성적을 등록하면 카테고리별 피드백이 표시됩니다.
              </p>
            ) : (
              <div className="space-y-3">
                {subjectAnalysisList.map((analysis) => (
                  <SubjectAnalysisCard
                    key={analysis.metrics.subject}
                    analysis={analysis}
                  />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── 오른쪽: 최근 공부 기록 + AI 성적 예측 ── */}
        <div className="space-y-6 sticky top-24">

          {/* 최근 공부 기록 */}
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">최근 공부 기록</h2>
              <StudyLogForm subjects={subjectOptions} />
            </div>
            {recentStudyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                공부 기록을 추가하면 여기에 표시됩니다.
              </p>
            ) : (
              <div className="h-[240px] overflow-y-auto pr-1">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 font-medium">날짜</th>
                      <th className="pb-2 font-medium">카테고리</th>
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
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${subjectBadgeClass(r.subject)}`}
                          >
                            {r.subject}
                          </span>
                        </td>
                        <td className="py-2 text-right text-xs">
                          {formatDuration(r.duration_minutes)}
                        </td>
                        <td className="py-2 text-right text-xs">
                          {r.difficulty ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${difficultyBadgeClass[r.difficulty] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {difficultyLabels[r.difficulty] ?? r.difficulty}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-2 text-right text-xs font-semibold">
                          {r.concentration_level != null ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 ${concentrationBadgeClass[r.concentration_level] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {r.concentration_level}/5
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1">
                            <StudyLogForm
                              subjects={subjectOptions}
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
              </div>
            )}
            {pendingStudyTasks.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">진행 중 할 일</p>
                  <StudyTaskForm subjects={subjectOptions} />
                </div>
                <div className="h-[240px] space-y-2 overflow-y-auto pr-1">
                  {pendingStudyTasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate">
                          <span
                            className={`mr-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${subjectBadgeClass(task.subject)}`}
                          >
                            {task.subject}
                          </span>
                          {task.title}
                        </p>
                        <p className="text-muted-foreground">
                          {task.priority ? priorityLabels[task.priority] ?? task.priority : "우선순위 없음"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StudyTaskForm
                          subjects={subjectOptions}
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
                <StudyTaskForm subjects={subjectOptions} />
              </div>
            )}
            {completedStudyTasks.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">최근 완료한 할 일</p>
                <div className="space-y-2">
                  {completedStudyTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 text-xs opacity-80">
                      <div className="min-w-0">
                        <p className="truncate line-through">
                          <span
                            className={`mr-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold no-underline ${subjectBadgeClass(task.subject)}`}
                          >
                            {task.subject}
                          </span>
                          {task.title}
                        </p>
                        <p className="text-muted-foreground">
                          {task.priority ? priorityLabels[task.priority] ?? task.priority : "우선순위 없음"}
                        </p>
                      </div>
                      <StudyTaskActions taskId={task.id} isCompleted={task.is_completed} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 성적 예측 */}
          {mockComparison && (
            <div className="rounded-2xl border bg-white p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold">모의고사와 내신 비교</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  최근 모의고사와 내신에서 함께 확인할 카테고리를 정리했습니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">최근 모의고사</p>
                  <p className="mt-1 font-semibold">{mockComparison.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    평균 등급 {mockComparison.averageGrade != null ? `${mockComparison.averageGrade}등급` : "-"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">함께 우선 확인</p>
                  <p className="mt-1 font-semibold">
                    {mockComparison.overlap.length > 0 ? mockComparison.overlap.join(", ") : "겹치는 카테고리 없음"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    모의고사와 내신 모두에서 보완이 필요한 카테고리
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  모의고사 보완 카테고리:{" "}
                  <span className="font-medium text-foreground">
                    {mockComparison.mockWeakSubjects.length > 0 ? mockComparison.mockWeakSubjects.join(", ") : "-"}
                  </span>
                </p>
                <p>
                  내신 관리 카테고리:{" "}
                  <span className="font-medium text-foreground">
                    {mockComparison.schoolWeakSubjects.length > 0 ? mockComparison.schoolWeakSubjects.join(", ") : "-"}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">성적 예측</h2>
            <PredictionSection predictions={categoryPredictions} subjectAvgs={subjectAvgs} />
          </div>

        </div>
      </div>
    </div>
  );
}
