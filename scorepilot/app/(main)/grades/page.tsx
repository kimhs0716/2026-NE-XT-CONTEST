import { createClient } from "@/lib/supabase/server";
import { type ExamType, type SemesterType } from "@/lib/constants/grades";
import GradeForm from "@/components/grades/GradeForm";
import GradeTable from "@/components/grades/GradeTable";

type ExamRow = {
  id: string;
  exam_type: string;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { score: number; max_score: number; percentage: number; memo: string | null }[];
};

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rows }, { data: subjectRows }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id,
        exam_type,
        semesters!exam_semester ( year, semester_type ),
        subjects ( name ),
        grade_records ( score, max_score, percentage, memo )
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subjects")
      .select("name")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  const subjectNames = [...new Set((subjectRows ?? []).map((s) => s.name))];

  const grades = (rows as ExamRow[] ?? []).flatMap((r) => {
    const grade = r.grade_records[0];
    if (!grade) return [];
    const subjectName = Array.isArray(r.subjects)
      ? r.subjects[0]?.name ?? ""
      : r.subjects?.name ?? "";
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    return [{
      examId: r.id,
      subject: subjectName,
      examType: r.exam_type as ExamType,
      score: grade.score,
      maxScore: grade.max_score,
      percentage: grade.percentage,
      semesterYear: sem.year,
      semesterType: sem.semester_type as SemesterType,
      memo: grade.memo,
    }];
  }).sort((a, b) => {
    const aOrder = a.semesterYear * 10 + (a.semesterType === "semester_2" ? 2 : 1);
    const bOrder = b.semesterYear * 10 + (b.semesterType === "semester_2" ? 2 : 1);
    return bOrder - aOrder;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">성적 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">
            과목별 시험 성적을 기록하고 관리하세요
          </p>
        </div>
        <GradeForm subjects={subjectNames} />
      </div>
      <GradeTable grades={grades} subjects={subjectNames} />
    </div>
  );
}
