import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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
  name: string;
  semester_id: string;
};

type SemesterRow = {
  id: string;
  year: number;
  semester_type: string;
};

const MAIN_EXAM_TYPES: ExamType[] = ["midterm", "assignment", "final"];

type SemesterView = {
  key: string;
  label: string;
  year: number;
  type: SemesterType;
  order: number;
};

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string }>;
  searchParams: Promise<{ semester?: string }>;
}) {
  const { subject: encodedSubject } = await params;
  const { semester: requestedSemesterKey } = await searchParams;
  const subject = decodeURIComponent(encodedSubject);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subjectRows }, { data: examsBySubject }, { data: semesterRows }] = await Promise.all([
    supabase.from("subjects").select("name, semester_id").eq("user_id", user!.id).order("name"),
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
      .eq("user_id", user!.id),
    supabase
      .from("semesters")
      .select("id, year, semester_type")
      .eq("user_id", user!.id)
      .order("year", { ascending: false })
      .order("semester_type", { ascending: false }),
  ]);

  const semesterById = new Map(
    ((semesterRows ?? []) as SemesterRow[]).map((semester) => {
      const type = semester.semester_type as SemesterType;
      return [semester.id, {
        key: `${semester.year}-${type}`,
        label: formatSemester(semester.year, type),
        year: semester.year,
        type,
        order: semester.year * 10 + (type === "semester_2" ? 2 : 1),
      }];
    }),
  );

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
        gradeLevel: grade.grade_level,
        weight: r.weight,
        semesterYear: sem.year,
        semesterType: sem.semester_type as SemesterType,
        semOrder: sem.year * 10 + (sem.semester_type === "semester_2" ? 2 : 1),
        memo: grade.memo,
        semesterLabel: formatSemester(sem.year, sem.semester_type as SemesterType),
      }];
    })
    .sort((a, b) => a.semOrder - b.semOrder);

  const subjectSemesterKeys = ((subjectRows ?? []) as SubjectRow[])
    .filter((row) => row.name === subject)
    .flatMap((row) => {
      const semester = semesterById.get(row.semester_id);
      return semester ? [semester.key] : [];
    });

  if (grades.length === 0 && subjectSemesterKeys.length === 0) notFound();

  const subjectNames = [...new Set(((subjectRows ?? []) as SubjectRow[]).map((s) => s.name))];

  /* 학기 목록 */
  const currentYear = new Date().getFullYear();
  const semesterSet = new Set([
    `${currentYear}-semester_1`,
    `${currentYear}-semester_2`,
    ...grades.map((g) => `${g.semesterYear}-${g.semesterType}`),
    ...subjectSemesterKeys,
  ]);
  const semesters: SemesterView[] = [...semesterSet]
    .map((key) => {
      const [year, type] = key.split("-");
      const semesterYear = parseInt(year, 10);
      const semesterType = type as SemesterType;
      return {
        key,
        label: formatSemester(semesterYear, semesterType),
        year: semesterYear,
        type: semesterType,
        order: semesterYear * 10 + (semesterType === "semester_2" ? 2 : 1),
      };
    })
    .sort((a, b) => b.order - a.order);
  const selectedSemester =
    semesters.find((semester) => semester.key === requestedSemesterKey) ?? semesters[0];
  const selectedGrades = grades.filter(
    (grade) => `${grade.semesterYear}-${grade.semesterType}` === selectedSemester.key,
  );

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
  for (const g of selectedGrades) {
    tableData[g.examType][g.semesterLabel] = g;
  }

  /* 차트 데이터 – 학기별 시험 유형 점수 */
  const chartData = [{
    semester: selectedSemester.label,
    ...Object.fromEntries(
      MAIN_EXAM_TYPES.map((et) => [examTypeLabels[et], tableData[et][selectedSemester.label]?.percentage ?? null]),
    ),
  }];

  const overallScore = Math.round(
    Math.min(
      100,
      selectedGrades.reduce((sum, grade) => sum + (grade.percentage * (grade.weight ?? 0)) / 100, 0),
    ) * 10,
  ) / 10;

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/grades?semester=${encodeURIComponent(selectedSemester.key)}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← 내신
            </Link>
          </div>
          <h1 className="text-2xl font-bold mt-1">{subject}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{selectedSemester.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <GradeForm
            subjects={subjectNames}
            fixedSubject={subject}
            fixedSemester={{
              year: selectedSemester.year,
              type: selectedSemester.type,
              label: selectedSemester.label,
            }}
          />
        </div>
      </div>

      {/* 그래프 영역 */}
      <SubjectCharts
        chartData={chartData}
        overallScore={overallScore}
        overallGradeStorageKey={`${subject}:${selectedSemester.key}`}
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
            {[selectedSemester].map((semester) => (
              <tr key={semester.key} className="border-b last:border-0">
                <td className="py-3 px-4 font-medium text-sm">
                  {semester.label}
                </td>
                {MAIN_EXAM_TYPES.map((et) => {
                  const cell = tableData[et][semester.label];
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
                            {cell.percentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cell.gradeLevel ? `${cell.gradeLevel}등급` : "등급 없음"}
                            {cell.weight != null ? ` · 반영 ${cell.weight}%` : ""}
                          </p>
                          <div className="flex items-center justify-center gap-1">
                            <GradeEditForm grade={cell} />
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
      {selectedGrades.filter((g) => g.examType === "mock_exam" || g.examType === "other").length > 0 && (
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
              {selectedGrades
                .filter((g) => g.examType === "mock_exam" || g.examType === "other")
                .map((g) => (
                  <tr key={g.examId} className="border-b last:border-0">
                    <td className="py-2.5">{g.semesterLabel}</td>
                    <td className="py-2.5">{examTypeLabels[g.examType]}</td>
                    <td className="py-2.5 text-right">{g.score} / {g.maxScore}</td>
                    <td className="py-2.5 text-right">{g.percentage.toFixed(1)}%</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <GradeEditForm grade={g} />
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
