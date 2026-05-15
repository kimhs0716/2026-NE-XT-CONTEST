import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  examTypeLabels,
  formatSemester,
  calcWeightedScore,
  getSubjectsBySchoolLevel,
  parseGradeSubjectName,
  type ExamType,
  type SemesterType,
} from "@/lib/constants/grades";
import SubjectCharts from "@/components/grades/SubjectCharts";
import GradeForm from "@/components/grades/GradeForm";
import GradeEditForm from "@/components/grades/GradeEditForm";
import GradeDeleteButton from "@/components/grades/GradeDeleteButton";
import SubjectGoalForm from "@/components/grades/SubjectGoalForm";
import SemesterGradeEdit from "@/components/grades/SemesterGradeEdit";
import { decodeSubjectSegment } from "@/lib/subject-route";

type ExamRow = {
  id: string;
  exam_type: string;
  weight: number | null;
  semesters:
    | { year: number; semester_type: string }
    | { year: number; semester_type: string }[]
    | null;
  grade_records: {
    score: number;
    max_score: number;
    percentage: number;
    grade_level: string | null;
    memo: string | null;
  }[];
};

type SubjectRow = {
  id: string;
  name: string;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
};

type GoalRow = {
  subject_id: string;
  target_score: number;
  target_date: string | null;
  memo: string | null;
};

const MAIN_EXAM_TYPES: ExamType[] = ["midterm", "assignment", "final"];

type ChartSeries = {
  key: string;
  label: string;
  isCurrent: boolean;
};

function gradeLevelClass(gradeLevel: string): string {
  const normalized = gradeLevel.trim().toUpperCase();
  if (normalized === "A" || normalized === "1") return "text-green-600";
  if (normalized === "B" || normalized === "2") return "text-blue-600";
  if (normalized === "C" || normalized === "3") return "text-yellow-600";
  if (normalized === "D" || normalized === "4") return "text-orange-500";
  return "text-red-500";
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: encodedSubject } = await params;
  const subject = decodeSubjectSegment(encodedSubject);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subjectRows }, { data: examsBySubject }, { data: goalRows }, { data: profile }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, name, semesters ( year, semester_type )")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("exams")
      .select(`
        id,
        exam_type,
        weight,
        semesters!exam_semester ( year, semester_type ),
        subjects ( name ),
        grade_records ( score, max_score, percentage, grade_level, memo )
      `)
      .eq("user_id", user.id),
    supabase
      .from("subject_goals")
      .select("subject_id, target_score, target_date, memo")
      .eq("user_id", user.id),
    supabase
      .from("profiles")
      .select("school_level")
      .eq("id", user.id)
      .single(),
  ]);

  const schoolLevel = profile?.school_level as "middle" | "high" | null;

  const allGrades = ((examsBySubject ?? []) as (ExamRow & { subjects: { name: string } | { name: string }[] | null })[])
    .flatMap((r) => {
      const subName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
      if (!subName) return [];
      const grade = r.grade_records[0];
      if (!grade) return [];
      const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
      if (!sem) return [];
      return [{
        examId: r.id,
        subject: subName,
        examType: r.exam_type as ExamType,
        weight: r.weight,
        score: grade.score,
        maxScore: grade.max_score,
        percentage: grade.percentage,
        gradeLevel: grade.grade_level,
        semesterYear: sem.year,
        semesterType: sem.semester_type as SemesterType,
        semOrder: sem.year * 10 + (sem.semester_type === "semester_2" ? 2 : 1),
        memo: grade.memo,
        semesterLabel: formatSemester(sem.year, sem.semester_type as SemesterType),
      }];
    })
    .sort((a, b) => a.semOrder - b.semOrder);
  const grades = allGrades.filter((g) => g.subject === subject);

  if (grades.length === 0) notFound();

  const typedSubjectRows = (subjectRows ?? []) as SubjectRow[];
  const subjectNames = [...new Set(typedSubjectRows.map((s) => s.name))];
  const presetSubjects = getSubjectsBySchoolLevel(schoolLevel);
  const parseSubject = (name: string) =>
    parseGradeSubjectName(name, schoolLevel, [...new Set([...presetSubjects, ...subjectNames])]);
  const currentCategory = parseSubject(subject).category;
  const displaySubjectName = (name: string) => {
    const parsed = parseSubject(name);
    return parsed.detail || name;
  };

  /* 학기 목록 */
  const semesterLabels = [...new Set(grades.map((g) => g.semesterLabel))];
  const latestSemester = semesterLabels[semesterLabels.length - 1];

  /* 과목별 시험 유형 × 학기 테이블 데이터 */
  type Grade = (typeof grades)[number];
  type Cell = Grade | null;
  const tableData: Record<ExamType, Record<string, Cell>> = {
    midterm: {},
    final: {},
    assignment: {},
    mock_exam: {},
    other: {},
  };
  for (const g of grades) {
    tableData[g.examType][g.semesterLabel] = g;
  }

  /* 차트 데이터 – 같은 분류의 학기별 반영비 적용 총점 */
  const chartSubjects = [
    ...new Set(
      allGrades
        .filter((g) => parseSubject(g.subject).category === currentCategory)
        .map((g) => g.subject),
    ),
  ].sort((a, b) => {
    if (a === subject) return 1;
    if (b === subject) return -1;
    return displaySubjectName(a).localeCompare(displaySubjectName(b), "ko");
  });
  const chartSemesterLabels = [
    ...new Set(
      allGrades
        .filter((g) => chartSubjects.includes(g.subject))
        .map((g) => g.semesterLabel),
    ),
  ];
  const weightedTotalFor = (subjectName: string, semesterLabel: string) => {
    const total = allGrades
      .filter(
        (g) =>
          g.subject === subjectName &&
          g.semesterLabel === semesterLabel &&
          MAIN_EXAM_TYPES.includes(g.examType) &&
          g.weight != null &&
          g.maxScore > 0,
      )
      .reduce((sum, g) => sum + (g.score / g.maxScore) * Number(g.weight), 0);

    return total > 0 ? Math.round(total * 10) / 10 : null;
  };
  const chartSeries: ChartSeries[] = [
    ...(chartSubjects.length > 1
      ? [{ key: "categoryAverage", label: `${currentCategory} 평균`, isCurrent: false }]
      : []),
    { key: "currentSubject", label: displaySubjectName(subject), isCurrent: true },
  ];
  const chartData = chartSemesterLabels.map((sem) => {
    const entry: Record<string, string | number | null> = { semester: sem };
    const categoryTotals = chartSubjects
      .map((name) => weightedTotalFor(name, sem))
      .filter((total): total is number => total !== null);
    entry.categoryAverage =
      categoryTotals.length > 0
        ? Math.round((categoryTotals.reduce((sum, total) => sum + total, 0) / categoryTotals.length) * 10) / 10
        : null;
    entry.currentSubject = weightedTotalFor(subject, sem);
    return entry;
  });

  /* 파이 차트 데이터 – 최신 학기 총점/만점 */
  const latestWeightedGrades = grades.filter(
    (g) =>
      g.semesterLabel === latestSemester &&
      MAIN_EXAM_TYPES.includes(g.examType) &&
      g.weight != null &&
      g.maxScore > 0,
  );
  const totalScore = latestWeightedGrades.reduce(
    (sum, g) => sum + (g.score / g.maxScore) * Number(g.weight),
    0,
  );
  const totalMaxScore = latestWeightedGrades.reduce((sum, g) => sum + Number(g.weight), 0);
  const roundedTotalScore = Math.round(totalScore * 10) / 10;
  const roundedTotalMaxScore = Math.round(totalMaxScore * 10) / 10;
  const pieData =
    roundedTotalMaxScore > 0
      ? [
          { name: "총점", value: roundedTotalScore, color: "#2563eb" },
          {
            name: "남은 점수",
            value: Math.max(roundedTotalMaxScore - roundedTotalScore, 0),
            color: "#e5e7eb",
            hidden: true,
          },
        ]
      : [];
  const pieSummary =
    roundedTotalMaxScore > 0
      ? {
          score: roundedTotalScore,
          maxScore: roundedTotalMaxScore,
          percentage: Math.round((roundedTotalScore / roundedTotalMaxScore) * 1000) / 10,
        }
      : null;

  const goalSubjectId = typedSubjectRows.find((s) => s.name === subject)?.id ?? null;
  const goal = goalSubjectId
    ? ((goalRows ?? []) as GoalRow[]).find((row) => row.subject_id === goalSubjectId)
    : undefined;
  const latestPercentage = grades[grades.length - 1]?.percentage ?? null;
  const targetGap =
    goal && latestPercentage !== null
      ? Math.round((latestPercentage - Number(goal.target_score)) * 10) / 10
      : null;

  /* 학기별 총점/등급 계산 */
  function calcSemesterSummary(sem: string): { weightedScore: number | null; gradeLevel: string | null; primaryExamId: string | null } {
    const m = tableData["midterm"][sem];
    const a = tableData["assignment"][sem];
    const f = tableData["final"][sem];
    const primaryExam = m ?? a ?? f ?? null;
    const primaryExamId = primaryExam?.examId ?? null;
    const gradeLevel =
      MAIN_EXAM_TYPES.map((et) => tableData[et][sem]?.gradeLevel?.trim())
        .find((level): level is string => Boolean(level)) ?? null;

    if (m?.weight != null && a?.weight != null && f?.weight != null) {
      const ws = calcWeightedScore([
        { percentage: m.percentage, weight: m.weight },
        { percentage: a.percentage, weight: a.weight },
        { percentage: f.percentage, weight: f.weight },
      ]);
      return { weightedScore: ws, gradeLevel, primaryExamId };
    }
    return { weightedScore: null, gradeLevel, primaryExamId };
  }

  const showTotalColumn = semesterLabels.some((sem) => calcSemesterSummary(sem).weightedScore !== null);
  const showGradeColumn = semesterLabels.some((sem) =>
    MAIN_EXAM_TYPES.some((et) => tableData[et][sem] != null)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/grades" className="text-sm text-muted-foreground hover:text-foreground">
              ← 내신
            </Link>
          </div>
          <h1 className="text-2xl font-bold mt-1">{subject}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{latestSemester}</p>
        </div>
        <div className="flex items-center gap-2">
          {goalSubjectId && (
            <SubjectGoalForm
              subjectId={goalSubjectId}
              subjectName={subject}
              goal={
                goal
                  ? {
                      targetScore: Number(goal.target_score),
                      targetDate: goal.target_date,
                      memo: goal.memo,
                    }
                  : null
              }
            />
          )}
          <GradeForm subjects={subjectNames} schoolLevel={schoolLevel} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs text-muted-foreground mb-1">최근 점수</p>
          <p className="text-2xl font-bold">
            {latestPercentage !== null ? `${latestPercentage.toFixed(1)}점` : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{latestSemester} 기준</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs text-muted-foreground mb-1">목표 점수</p>
          <p className="text-2xl font-bold">
            {goal ? `${Number(goal.target_score).toFixed(1)}점` : "미설정"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {goal?.target_date ? `${goal.target_date}까지` : "목표를 설정해 추적하세요"}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs text-muted-foreground mb-1">목표 대비 현재 위치</p>
          <p className={`text-2xl font-bold ${targetGap !== null && targetGap >= 0 ? "text-green-600" : "text-yellow-600"}`}>
            {targetGap === null ? "-" : targetGap > 0 ? `+${targetGap}점` : targetGap === 0 ? "목표 달성" : `${targetGap}점`}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {targetGap === null
              ? goal?.memo ?? "목표를 설정해 추적하세요"
              : targetGap > 0
                ? `목표보다 ${targetGap}점 앞서 있어요`
                : targetGap === 0
                  ? "목표에 도달했어요"
                  : `목표까지 ${Math.abs(targetGap)}점 남음`}
          </p>
        </div>
      </div>

      {/* 그래프 영역 */}
      <SubjectCharts
        chartData={chartData}
        chartSeries={chartSeries}
        currentSemester={latestSemester}
        pieData={pieData}
        pieSummary={pieSummary}
      />

      {/* 점수 테이블 */}
      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="py-3 px-4 text-left font-medium text-muted-foreground w-28">학기</th>
              {MAIN_EXAM_TYPES.map((et) => (
                <th key={et} className="py-3 px-4 text-center font-medium text-muted-foreground">
                  {examTypeLabels[et]}
                </th>
              ))}
              {showTotalColumn && (
                <th className="py-3 px-4 text-center font-medium text-muted-foreground">총점</th>
              )}
              {showGradeColumn && (
                <th className="py-3 px-4 text-center font-medium text-muted-foreground">등급</th>
              )}
            </tr>
          </thead>
          <tbody>
            {semesterLabels.map((sem) => {
              const { weightedScore, gradeLevel, primaryExamId } = calcSemesterSummary(sem);
              return (
                <tr key={sem} className="border-b last:border-0">
                  <td className="py-3 px-4 font-medium text-sm">{sem}</td>
                  {MAIN_EXAM_TYPES.map((et) => {
                    const cell = tableData[et][sem];
                    const pctColor = cell
                      ? cell.percentage >= 80
                        ? "text-green-600"
                        : cell.percentage >= 60
                        ? "text-yellow-600"
                        : "text-red-500"
                      : "text-muted-foreground";
                    return (
                      <td key={et} className="py-3 px-4 text-center">
                        {cell ? (
                          <div className="space-y-1.5">
                            <p className="font-semibold">
                              {cell.score} / {cell.maxScore}
                            </p>
                            <p className={`text-xs ${pctColor}`}>
                              {cell.percentage.toFixed(1)}점
                              {cell.weight != null && (
                                <span className="text-muted-foreground ml-1">({cell.weight}%)</span>
                              )}
                            </p>
                            <div className="flex items-center justify-center gap-1">
                              <GradeEditForm grade={cell} subjects={subjectNames} schoolLevel={schoolLevel} />
                              <GradeDeleteButton examId={cell.examId} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  {showTotalColumn && (
                    <td className="py-3 px-4 text-center">
                      {weightedScore !== null ? (
                        <span className={
                          weightedScore >= 80 ? "font-semibold text-green-600" :
                          weightedScore >= 60 ? "font-semibold text-yellow-600" :
                          "font-semibold text-red-500"
                        }>
                          {weightedScore.toFixed(1)}점
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">반영비 입력 필요</span>
                      )}
                    </td>
                  )}
                  {showGradeColumn && (
                    <td className="py-3 px-4 text-center">
                      {primaryExamId ? (
                        <SemesterGradeEdit examId={primaryExamId} initialGrade={gradeLevel} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 기타 점수 (mock_exam, other) */}
      {grades.filter((g) => g.examType === "mock_exam" || g.examType === "other").length > 0 && (
        <div className="rounded-2xl border bg-white p-6">
          <h2 className="text-base font-semibold mb-4">기타 성적</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">학기</th>
                <th className="pb-2 font-medium">유형</th>
                <th className="pb-2 font-medium text-right">점수</th>
                <th className="pb-2 font-medium text-right">백분율</th>
                <th className="pb-2 font-medium text-right">등급</th>
                <th className="pb-2 font-medium text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {grades
                .filter((g) => g.examType === "mock_exam" || g.examType === "other")
                .map((g) => (
                  <tr key={g.examId} className="border-b last:border-0">
                    <td className="py-2.5">{g.semesterLabel}</td>
                    <td className="py-2.5">{examTypeLabels[g.examType]}</td>
                    <td className="py-2.5 text-right">{g.score} / {g.maxScore}</td>
                    <td className="py-2.5 text-right">{g.percentage.toFixed(1)}점</td>
                    <td className="py-2.5 text-right">
                      {g.gradeLevel ? (
                        <span className={`font-semibold ${gradeLevelClass(g.gradeLevel)}`}>{g.gradeLevel}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <GradeEditForm grade={g} subjects={subjectNames} schoolLevel={schoolLevel} />
                        <GradeDeleteButton examId={g.examId} />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
