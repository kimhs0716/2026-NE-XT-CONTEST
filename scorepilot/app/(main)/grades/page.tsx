import { createClient } from "@/lib/supabase/server";
import { type ExamType } from "@/lib/constants/grades";
import GradeForm from "@/components/grades/GradeForm";
import GradeTable from "@/components/grades/GradeTable";

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rows }, { data: subjectRows }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id,
        exam_type,
        exam_date,
        subjects ( name ),
        grade_records ( score, max_score, percentage, memo )
      `)
      .eq("user_id", user!.id)
      .order("exam_date", { ascending: false }),
    supabase
      .from("subjects")
      .select("name")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  const subjectNames = subjectRows?.map((s) => s.name) ?? [];

  type Row = {
    id: string;
    exam_type: string;
    exam_date: string;
    subjects: { name: string } | { name: string }[] | null;
    grade_records: { score: number; max_score: number; percentage: number; memo: string | null }[];
  };

  const grades = (rows as Row[] ?? []).flatMap((r) => {
    const grade = r.grade_records[0];
    if (!grade) return [];
    const subjectName = Array.isArray(r.subjects)
      ? r.subjects[0]?.name ?? ""
      : r.subjects?.name ?? "";
    return [{
      examId: r.id,
      subject: subjectName,
      examType: r.exam_type as ExamType,
      score: grade.score,
      maxScore: grade.max_score,
      percentage: grade.percentage,
      date: r.exam_date,
      memo: grade.memo,
    }];
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
