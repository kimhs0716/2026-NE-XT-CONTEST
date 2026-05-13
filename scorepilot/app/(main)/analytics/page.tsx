import { createClient } from "@/lib/supabase/server";
import { formatSemester, type ExamType, type SemesterType } from "@/lib/constants/grades";
import AnalysisGradeTrendChart, { type GradeTrendSourceRow } from "@/components/analytics/AnalysisGradeTrendChart";
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
  grade_records: { percentage: number; score: number; max_score: number; grade_level: string | null }[];
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

type MockExamRow = {
  exam_year: number;
  exam_month: number;
  subject: string;
  raw_score: number | null;
  percentile: number | null;
  grade: number | null;
  target_score: number | null;
};

const GRADE_BASED_MOCK_SUBJECTS = new Set(["영어", "한국사"]);

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

const priorityLabels: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

function buildChartData(
  rows: { semester: string; semOrder: number; trendOrder: number; subject: string; percentage: number }[],
) {
  const subjects = [...new Set(rows.map((r) => r.subject))];
  const sortedRows = [...rows].sort((a, b) => a.trendOrder - b.trendOrder);
  const semesterTotals = sortedRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.semester] = (acc[row.semester] ?? 0) + 1;
    return acc;
  }, {});
  const semesterCounts: Record<string, number> = {};
  const data = sortedRows.map((row) => {
    semesterCounts[row.semester] = (semesterCounts[row.semester] ?? 0) + 1;
    const label = semesterTotals[row.semester] > 1
      ? `${row.semester} ${semesterCounts[row.semester]}차`
      : row.semester;
    return {
      semester: label,
      ...Object.fromEntries(subjects.map((subject) => [subject, subject === row.subject ? row.percentage : null])),
      "전체 평균": row.percentage,
    };
  });
  return { data, subjects };
}

function withTrendOrder<T extends { semOrder: number; createdAt: string }>(rows: T[]): (T & { trendOrder: number })[] {
  return [...rows]
    .sort((a, b) => a.semOrder - b.semOrder || a.createdAt.localeCompare(b.createdAt))
    .map((row, index) => ({ ...row, trendOrder: row.semOrder * 1000 + index }));
}

function mockExamOrder(row: MockExamRow): number {
  return row.exam_year * 100 + row.exam_month;
}

function formatMockMainValue(row: MockExamRow): string {
  if (GRADE_BASED_MOCK_SUBJECTS.has(row.subject)) {
    return row.grade != null ? `${row.grade}등급` : "-";
  }
  return row.percentile != null ? `${Number(row.percentile.toFixed(1)).toLocaleString("ko-KR")}%` : "-";
}

function formatMockSubValue(row: MockExamRow): string {
  const parts: string[] = [];
  if (row.raw_score != null) parts.push(`${row.raw_score}점`);
  if (row.target_score != null) parts.push(`목표 ${row.target_score}점`);
  return parts.length > 0 ? parts.join(" · ") : "원점수 없음";
}

function resolveCategory(subject: { name: string; category: string | null } | undefined): string {
  return subject?.category?.trim() || "미분류";
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: rows },
    { data: predRows },
    { data: studyLogRows },
    { data: studyTaskRows },
    { data: subjectRows },
    { data: mockExamRows },
  ] = await Promise.all([
    supabase
      .from("exams")
      .select(
        `exam_type, subjects ( name, category ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage, score, max_score, grade_level ), created_at`,
      )
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("score_predictions")
      .select(`predicted_score, prediction_target, confidence, basis, created_at, subjects ( name )`)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("study_logs")
      .select(
        `id, subject_id, study_date, duration_minutes, difficulty, concentration_level, content, subjects ( name, category )`,
      )
      .eq("user_id", user!.id)
      .order("study_date", { ascending: false })
      .limit(8),
    supabase
      .from("study_tasks")
      .select(`id, subject_id, title, task_type, due_date, priority, is_completed, memo, subjects ( name, category )`)
      .eq("user_id", user!.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(3),
    supabase
      .from("subjects")
      .select("id, name, category")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("mock_exam_records")
      .select("exam_year, exam_month, subject, raw_score, percentile, grade, target_score")
      .eq("user_id", user!.id)
      .order("exam_year", { ascending: false })
      .order("exam_month", { ascending: false }),
  ]);

  // 유효한 성적 데이터
  const trendRows: GradeTrendSourceRow[] = [];
  const validRows = (rows as ExamRow[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const subject = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!subject?.name) return [];
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    const type = sem.semester_type as SemesterType;
    const category = resolveCategory(subject);
    const semesterKey = `${sem.year}-${type}`;
    trendRows.push({
      subjectName: subject.name,
      category,
      semesterKey,
      semesterLabel: formatSemester(sem.year, type),
      semOrder: semesterOrder(sem.year, type),
      examType: r.exam_type as ExamType,
      gradeLevel: r.grade_records[0].grade_level,
      createdAt: r.created_at,
    });
    return [{
      subject: category,
      percentage: Number(pct),
      score: r.grade_records[0].score,
      maxScore: r.grade_records[0].max_score,
      semester: formatSemester(sem.year, type),
      semOrder: semesterOrder(sem.year, type),
      createdAt: r.created_at,
    }];
  });

  const orderedRows = withTrendOrder(validRows);
  const chart = buildChartData(orderedRows);
  const subjectNames = [...chart.subjects].sort((a, b) => a.localeCompare(b, "ko"));
  const subjectOptions = [...new Map(
    ((subjectRows ?? []) as SubjectRow[]).map((subject) => [subject.name, subject]),
  ).values()];

  // 분류별 분석
  const subjectGradeMap = new Map<string, GradePoint[]>();
  for (const r of orderedRows) {
    if (!subjectGradeMap.has(r.subject)) subjectGradeMap.set(r.subject, []);
    subjectGradeMap.get(r.subject)!.push({ percentage: r.percentage, semOrder: r.trendOrder });
  }

  const subjectAnalysisList: SubjectAnalysis[] = [...subjectGradeMap.entries()].map(
    ([subject, grades]) => {
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

  // 요약 수치
  const allAvgs = subjectAnalysisList.map((s) => s.metrics.average);
  const overallAvg =
    allAvgs.length > 0
      ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10
      : null;

  // 예측 데이터
  const predictions = (predRows ?? [])
    .map((r) => {
      const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
      return {
        subject_name: sub?.name ?? "",
        predicted_score: Number(r.predicted_score),
        prediction_target: r.prediction_target,
        confidence: Number(r.confidence),
        basis: r.basis,
        created_at: r.created_at,
      };
    })
    .filter((p) => p.subject_name);

  const subjectAvgs = subjectAnalysisList.map((s) => ({
    subject: s.metrics.subject,
    avg: s.metrics.average,
  }));

  const recentStudyLogs = ((studyLogRows ?? []) as StudyLogRow[]).map((r) => {
    const subject = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    const category = resolveCategory(Array.isArray(r.subjects) ? r.subjects[0] : r.subjects ?? undefined);
    return { ...r, subject: subject ? `${category} · ${subject}` : "-" };
  });

  const pendingStudyTasks = ((studyTaskRows ?? []) as StudyTaskRow[]).map((r) => {
    const subject = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    const category = resolveCategory(Array.isArray(r.subjects) ? r.subjects[0] : r.subjects ?? undefined);
    return { ...r, subject: subject ? `${category} · ${subject}` : null };
  });

  const mockRecords = ((mockExamRows ?? []) as MockExamRow[]).sort(
    (a, b) => mockExamOrder(b) - mockExamOrder(a) || a.subject.localeCompare(b.subject, "ko"),
  );
  const latestMockOrder = mockRecords[0] ? mockExamOrder(mockRecords[0]) : null;
  const latestMockRows = latestMockOrder == null
    ? []
    : mockRecords.filter((row) => mockExamOrder(row) === latestMockOrder);
  const mockPercentiles = mockRecords
    .filter((row) => !GRADE_BASED_MOCK_SUBJECTS.has(row.subject) && row.percentile != null)
    .map((row) => row.percentile as number);
  const mockGrades = mockRecords
    .filter((row) => GRADE_BASED_MOCK_SUBJECTS.has(row.subject) && row.grade != null)
    .map((row) => row.grade as number);
  const mockAveragePercentile = mockPercentiles.length > 0
    ? Math.round((mockPercentiles.reduce((a, b) => a + b, 0) / mockPercentiles.length) * 10) / 10
    : null;
  const mockAverageGrade = mockGrades.length > 0
    ? Math.round((mockGrades.reduce((a, b) => a + b, 0) / mockGrades.length) * 10) / 10
    : null;
  const latestMockLabel = latestMockRows[0]
    ? `${latestMockRows[0].exam_year}년 ${latestMockRows[0].exam_month}월`
    : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 space-y-6">
      {/* ?ㅻ뜑 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">분석</h1>
          <p className="text-muted-foreground text-sm mt-1">
            과목 분류별 성적 추이와 AI 맞춤 피드백을 확인하세요.
          </p>
        </div>
        <AnalysisModeSelect subjects={subjectNames} />
      </div>

      {/* 2컬럼 메인 레이아웃 */}
      <div className="grid grid-cols-1 gap-6 items-start xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">

        {/* 왼쪽: 종합 성적 + 학습 피드백 */}
        <div className="min-w-0 space-y-6">

          {/* 종합 성적 */}
          <div className="min-w-0 rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">종합 성적</h2>
              {overallAvg !== null && (
                <span className="text-sm text-muted-foreground">
                  전체 평균 <span className="font-semibold text-foreground">{overallAvg}%</span>
                </span>
              )}
            </div>
            <AnalysisGradeTrendChart rows={trendRows} categories={chart.subjects} />
          </div>

          {/* 모의고사 분석 */}
          <div className="min-w-0 rounded-2xl border bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold">모의고사 분석</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {latestMockLabel ? `${latestMockLabel} 기준` : "모의고사 성적을 입력하면 표시됩니다."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2.5 py-1">
                  백분위 평균 {mockAveragePercentile != null ? `${mockAveragePercentile}%` : "-"}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  등급 평균 {mockAverageGrade != null ? `${mockAverageGrade}등급` : "-"}
                </span>
              </div>
            </div>
            {latestMockRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                모의고사 성적을 등록하면 최근 회차 분석이 표시됩니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {latestMockRows.map((row) => (
                  <div key={row.subject} className="rounded-xl border bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{row.subject}</span>
                      <span className="text-base font-bold">{formatMockMainValue(row)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatMockSubValue(row)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 학습 피드백 */}
          <div className="min-w-0 rounded-2xl border bg-white p-6">
            <h2 className="text-base font-semibold mb-4">학습 피드백</h2>
            <div className="mb-4">
              <AiFeedbackCard />
            </div>
            {subjectAnalysisList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                성적을 등록하면 분류별 피드백이 표시됩니다.
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

        {/* 오른쪽: 최근 공부 기록 + AI 성적 예측 */}
        <div className="min-w-0 space-y-6 xl:sticky xl:top-24">

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
                  <p className="text-xs font-semibold text-muted-foreground">진행 중인 할 일</p>
                  <StudyTaskForm subjects={subjectOptions} />
                </div>
                <div className="space-y-2">
                  {pendingStudyTasks.map((task, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate">
                          {task.subject ? `${task.subject} · ` : ""}
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
          </div>

          {/* AI 성적 예측 */}
          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">AI 성적 예측</h2>
            <PredictionSection predictions={predictions} subjectAvgs={subjectAvgs} />
          </div>

        </div>
      </div>
    </div>
  );
}
