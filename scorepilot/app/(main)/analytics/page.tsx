import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";
import GradeChartWithFilter from "@/components/analytics/GradeChartWithFilter";
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
import { computePrediction } from "@/lib/analytics/prediction";
import type { GradePoint, SubjectAnalysis } from "@/lib/analytics/types";

type ExamRow = {
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
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
  const bySem = new Map<string, { semOrder: number; scores: Record<string, number | null> }>();
  for (const r of rows) {
    if (!bySem.has(r.semester)) {
      bySem.set(r.semester, {
        semOrder: r.semOrder,
        scores: Object.fromEntries(subjects.map((s) => [s, null])),
      });
    }
    bySem.get(r.semester)!.scores[r.subject] = r.percentage;
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

function gradeToNumber(grade: string | null | undefined): number | null {
  if (!grade) return null;
  const t = grade.trim().toUpperCase();
  const n = Number(t);
  if (!isNaN(n) && n >= 1 && n <= 9) return n;
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  return map[t] ?? null;
}

function buildGradeChartData(
  rows: { semester: string; semOrder: number; subject: string; gradeValue: number }[],
) {
  const subjects = [...new Set(rows.map((r) => r.subject))];
  const bySem = new Map<string, { semOrder: number; scores: Record<string, number | null> }>();
  for (const r of rows) {
    if (!bySem.has(r.semester)) {
      bySem.set(r.semester, {
        semOrder: r.semOrder,
        scores: Object.fromEntries(subjects.map((s) => [s, null])),
      });
    }
    bySem.get(r.semester)!.scores[r.subject] = r.gradeValue;
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

function subjectCategory(name: string): string {
  const idx = name.indexOf("(");
  return idx > 0 ? name.slice(0, idx) : name;
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("school_level")
    .eq("user_id", user.id)
    .single();
  const schoolLevel = (profileData as { school_level: string | null } | null)?.school_level as "middle" | "high" | null;

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
        `exam_type, subjects ( name ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage, score, max_score, grade_level ), created_at`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("score_predictions")
      .select(`predicted_score, prediction_target, confidence, basis, created_at, subjects ( name )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("study_logs")
      .select(
        `id, subject_id, study_date, duration_minutes, difficulty, concentration_level, content, subjects ( name )`,
      )
      .eq("user_id", user.id)
      .order("study_date", { ascending: false })
      .limit(20),
    supabase
      .from("study_tasks")
      .select(`id, subject_id, title, task_type, due_date, priority, is_completed, memo, subjects ( name )`)
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(40),
    supabase
      .from("subjects")
      .select("id, name")
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
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
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

  // ── 등급 기반 차트 데이터 (grade_level 입력된 과목만) ─────────
  const gradeValidRows = (rows as ExamRow[] ?? []).flatMap((r) => {
    const gradeNum = gradeToNumber(r.grade_records[0]?.grade_level);
    if (gradeNum === null) return [];
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    const type = sem.semester_type as SemesterType;
    return [{ subject: name, gradeValue: gradeNum, semester: formatSemester(sem.year, type), semOrder: semesterOrder(sem.year, type) }];
  });
  const gradeChart = buildGradeChartData(gradeValidRows);

  const gradeSubjectAvgValues = [...new Set(gradeValidRows.map((r) => r.subject))].map((s) => {
    const vals = gradeValidRows.filter((r) => r.subject === s).map((r) => r.gradeValue);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  const gradeOverallAvg =
    gradeSubjectAvgValues.length > 0
      ? Math.round((gradeSubjectAvgValues.reduce((a, b) => a + b, 0) / gradeSubjectAvgValues.length) * 10) / 10
      : null;

  const gradeCategoryMap: Record<string, string> = {};
  for (const name of gradeChart.subjects) gradeCategoryMap[name] = subjectCategory(name);
  const gradeUniqueCategories = [...new Set(Object.values(gradeCategoryMap))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );

  const subjectNames = [...chart.subjects].sort((a, b) => a.localeCompare(b, "ko"));
  const subjectOptions = [...new Map(
    ((subjectRows ?? []) as SubjectRow[]).map((subject) => [subject.name, subject]),
  ).values()];

  // ── 과목별 분석 ───────────────────────────────────────────────
  const subjectGradeMap = new Map<string, GradePoint[]>();
  for (const r of validRows) {
    if (!subjectGradeMap.has(r.subject)) subjectGradeMap.set(r.subject, []);
    subjectGradeMap.get(r.subject)!.push({ percentage: r.percentage, semOrder: r.semOrder });
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

  // ── 요약 수치 (차트 헤더용) ───────────────────────────────────
  const allAvgs = subjectAnalysisList.map((s) => s.metrics.average);
  const overallAvg =
    allAvgs.length > 0
      ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10
      : null;

  // ── 차트 분류 필터 ────────────────────────────────────────────
  const categoryMap: Record<string, string> = {};
  for (const name of chart.subjects) categoryMap[name] = subjectCategory(name);
  const uniqueCategories = [...new Set(Object.values(categoryMap))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );

  // ── 예측 데이터 ───────────────────────────────────────────────
  const allPredictions = (predRows ?? [])
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

  // 현재(최신) 학기 내신 과목
  const maxSemOrder = validRows.length > 0 ? Math.max(...validRows.map((r) => r.semOrder)) : 0;
  const currentSemSubjects = new Set(
    validRows.filter((r) => r.semOrder === maxSemOrder).map((r) => r.subject),
  );

  // 최근 모의고사 과목
  const latestMockOrder =
    (mockRows ?? []).length > 0
      ? Math.max(...(mockRows as MockExamRow[]).map((r) => r.exam_year * 100 + r.exam_month))
      : 0;
  const latestMockSubjects = new Set(
    (mockRows as MockExamRow[])
      .filter((r) => r.exam_year * 100 + r.exam_month === latestMockOrder)
      .map((r) => r.subject),
  );

  // 내신 예측: DB 저장 예측 중 현재 학기 과목 (동일 과목명 중복 제거, 최신 우선)
  const schoolPredictions = Array.from(
    new Map(
      allPredictions
        .filter((p) => currentSemSubjects.has(p.subject_name))
        .map((p) => [p.subject_name, p]),
    ).values(),
  );

  // 모의고사 예측: mock_exam_records의 raw_score 추세로 실시간 계산
  // 모의고사 과목은 보통 단순명 (국어, 수학 등)이지만 동일 로직 적용
  const mockCategoryAccum = new Map<string, Map<number, number[]>>();
  const mockSubjectToCat = new Map<string, string>();
  for (const r of (mockRows ?? []) as MockExamRow[]) {
    if (r.raw_score == null) continue;
    const cat = subjectCategory(r.subject);
    mockSubjectToCat.set(r.subject, cat);
    if (!mockCategoryAccum.has(cat)) mockCategoryAccum.set(cat, new Map());
    const semMap = mockCategoryAccum.get(cat)!;
    const order = r.exam_year * 100 + r.exam_month;
    if (!semMap.has(order)) semMap.set(order, []);
    semMap.get(order)!.push(r.raw_score);
  }

  const mockCategoryGrades = new Map<string, GradePoint[]>();
  for (const [cat, semMap] of mockCategoryAccum.entries()) {
    const points = [...semMap.entries()].map(([semOrder, scores]) => ({
      semOrder,
      percentage: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));
    mockCategoryGrades.set(cat, points);
  }

  // 모의고사 과목별 최근 원점수 (델타 계산용)
  const mockSubjectHistory = new Map<string, number[]>();
  for (const r of (mockRows ?? []) as MockExamRow[]) {
    if (r.raw_score == null) continue;
    if (!mockSubjectHistory.has(r.subject)) mockSubjectHistory.set(r.subject, []);
    mockSubjectHistory.get(r.subject)!.push(r.raw_score);
  }

  const mockPredictions = [...latestMockSubjects]
    .map((subject) => {
      const cat = mockSubjectToCat.get(subject) ?? subjectCategory(subject);
      const trainingData = mockCategoryGrades.get(cat) ?? [];
      if (trainingData.length === 0) return null;
      const result = computePrediction(trainingData);
      if (!result) return null;
      return {
        subject_name: subject,
        predicted_score: result.predictedScore,
        prediction_target: `${subject} 다음 모의고사`,
        confidence: result.confidence,
        basis: result.basis,
        created_at: new Date().toISOString(),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const mockSubjectAvgs = [...latestMockSubjects]
    .map((subject) => {
      const history = mockSubjectHistory.get(subject) ?? [];
      if (history.length === 0) return null;
      const avg = history.reduce((a, b) => a + b, 0) / history.length;
      return { subject, avg: Math.round(avg * 10) / 10 };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const subjectAvgs = subjectAnalysisList.map((s) => ({
    subject: s.metrics.subject,
    avg: s.metrics.average,
  }));

  const recentStudyLogs = ((studyLogRows ?? []) as StudyLogRow[]).map((r) => {
    const subject = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    return { ...r, subject: subject ?? "기타" };
  });

  const allStudyTasks = ((studyTaskRows ?? []) as StudyTaskRow[]).map((r) => {
    const subject = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
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
            과목별 성적 추이와 학습 피드백을 확인하세요
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
            <h2 className="text-base font-semibold mb-4">종합 성적</h2>
            {schoolLevel === "high" ? (
              <GradeChartWithFilter
                data={gradeChart.data}
                subjects={gradeChart.subjects}
                categoryMap={gradeCategoryMap}
                categories={gradeUniqueCategories}
                overallAvg={gradeOverallAvg}
                mode="grade"
              />
            ) : (
              <GradeChartWithFilter
                data={chart.data}
                subjects={chart.subjects}
                categoryMap={categoryMap}
                categories={uniqueCategories}
                overallAvg={overallAvg}
                mode="score"
              />
            )}
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
                성적을 등록하면 과목별 피드백이 표시됩니다.
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
                  최근 모의고사와 내신에서 함께 확인할 과목을 정리했습니다.
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
                    {mockComparison.overlap.length > 0 ? mockComparison.overlap.join(", ") : "겹치는 과목 없음"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    모의고사와 내신 모두에서 보완이 필요한 과목
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>
                  모의고사 보완 과목:{" "}
                  <span className="font-medium text-foreground">
                    {mockComparison.mockWeakSubjects.length > 0 ? mockComparison.mockWeakSubjects.join(", ") : "-"}
                  </span>
                </p>
                <p>
                  내신 관리 과목:{" "}
                  <span className="font-medium text-foreground">
                    {mockComparison.schoolWeakSubjects.length > 0 ? mockComparison.schoolWeakSubjects.join(", ") : "-"}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">성적 예측</h2>
            <PredictionSection
              schoolPredictions={schoolPredictions}
              mockPredictions={mockPredictions}
              subjectAvgs={subjectAvgs}
              mockSubjectAvgs={mockSubjectAvgs}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
