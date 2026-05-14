import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  examTypeLabels,
  formatSemester,
  type ExamType,
  type SemesterType,
} from "@/lib/constants/grades";
import SubjectCharts from "@/components/grades/SubjectCharts";
import GradeForm from "@/components/grades/GradeForm";
import GradeEditForm from "@/components/grades/GradeEditForm";
import GradeDeleteButton from "@/components/grades/GradeDeleteButton";
import SubjectGoalForm from "@/components/grades/SubjectGoalForm";
import { decodeSubjectSegment } from "@/lib/subject-route";

type ExamRow = {
  id: string;
  exam_type: string;
  semesters:
    | { year: number; semester_type: string }
    | { year: number; semester_type: string }[]
    | null;
  grade_records: { score: number; max_score: number; percentage: number; memo: string | null }[];
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

  const [{ data: subjectRows }, { data: examsBySubject }, { data: goalRows }] = await Promise.all([
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
        semesters!exam_semester ( year, semester_type ),
        subjects ( name ),
        grade_records ( score, max_score, percentage, memo )
      `)
      .eq("user_id", user.id),
    supabase
      .from("subject_goals")
      .select("subject_id, target_score, target_date, memo")
      .eq("user_id", user.id),
  ]);

  const grades = ((examsBySubject ?? []) as (ExamRow & { subjects: { name: string } | { name: string }[] | null })[])
    .flatMap((r) => {
      const subName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
      if (subName !== subject) return [];
      const grade = r.grade_records[0];
      if (!grade) return [];
      const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
      if (!sem) return [];
      return [{
        examId: r.id,
        subject,
        examType: r.exam_type as ExamType,
        score: grade.score,
        maxScore: grade.max_score,
        percentage: grade.percentage,
        semesterYear: sem.year,
        semesterType: sem.semester_type as SemesterType,
        semOrder: sem.year * 10 + (sem.semester_type === "semester_2" ? 2 : 1),
        memo: grade.memo,
        semesterLabel: formatSemester(sem.year, sem.semester_type as SemesterType),
      }];
    })
    .sort((a, b) => a.semOrder - b.semOrder);

  if (grades.length === 0) notFound();

  const typedSubjectRows = (subjectRows ?? []) as SubjectRow[];
  const subjectNames = [...new Set(typedSubjectRows.map((s) => s.name))];

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

  /* 차트 데이터 – 학기별 시험 유형 점수 */
  const chartData = semesterLabels.map((sem) => {
    const entry: Record<string, string | number | null> = { semester: sem };
    for (const et of MAIN_EXAM_TYPES) {
      entry[examTypeLabels[et]] = tableData[et][sem]?.percentage ?? null;
    }
    return entry;
  });

  /* 파이 차트 데이터 – 시험 유형별 평균 */
  const pieData = MAIN_EXAM_TYPES.flatMap((et) => {
    const vals = grades.filter((g) => g.examType === et).map((g) => g.percentage);
    if (vals.length === 0) return [];
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return [{ name: examTypeLabels[et], value: Math.round(avg * 10) / 10 }];
  });

  const subjectIds = typedSubjectRows
    .filter((s) => s.name === subject)
    .map((s) => {
      const sem = Array.isArray(s.semesters) ? s.semesters[0] : s.semesters;
      return {
        id: s.id,
        order: sem ? sem.year * 10 + (sem.semester_type === "semester_2" ? 2 : 1) : 0,
      };
    })
    .sort((a, b) => b.order - a.order);
  const goalSubjectId = subjectIds[0]?.id;
  const goal = ((goalRows ?? []) as GoalRow[]).find((row) =>
    subjectIds.some((s) => s.id === row.subject_id),
  );
  const latestPercentage = grades[grades.length - 1]?.percentage ?? null;
  const targetGap =
    goal && latestPercentage !== null
      ? Math.round((latestPercentage - Number(goal.target_score)) * 10) / 10
      : null;

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
          <GradeForm subjects={subjectNames} />
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
        pieData={pieData}
        examTypeLabels={Object.fromEntries(MAIN_EXAM_TYPES.map((et) => [et, examTypeLabels[et]]))}
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
            </tr>
          </thead>
          <tbody>
            {semesterLabels.map((sem) => (
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
                          </p>
                          <div className="flex items-center justify-center gap-1">
                            <GradeEditForm grade={cell} subjects={subjectNames} />
                            <GradeDeleteButton examId={cell.examId} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
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
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <GradeEditForm grade={g} subjects={subjectNames} />
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
