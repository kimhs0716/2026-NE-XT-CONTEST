import { createClient } from "@/lib/supabase/server";
import GradeChart from "@/components/analytics/GradeChart";

type Row = {
  exam_date: string;
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { percentage: number }[];
};

const EXAM_TYPES = ["midterm", "final", "mock_exam"];
const ASSIGNMENT_TYPES = ["assignment"];

function buildChartData(rows: { date: string; subject: string; percentage: number }[]) {
  const subjects = [...new Set(rows.map((r) => r.subject))];
  const byDate = new Map<string, Record<string, number | null>>();
  for (const r of rows) {
    if (!byDate.has(r.date)) {
      byDate.set(r.date, Object.fromEntries(subjects.map((s) => [s, null])));
    }
    byDate.get(r.date)![r.subject] = r.percentage;
  }
  const data = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => {
      const values = Object.values(scores).filter((v): v is number => v !== null);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        date,
        ...scores,
        "전체 평균": avg !== null ? Math.round(avg * 10) / 10 : null,
      };
    });
  return { data, subjects };
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("exams")
    .select(`
      exam_date,
      exam_type,
      subjects ( name ),
      grade_records ( percentage )
    `)
    .eq("user_id", user!.id)
    .order("exam_date", { ascending: true });

  const validRows = (rows as Row[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    return [{ date: r.exam_date, examType: r.exam_type, subject: name, percentage: Number(pct) }];
  });

  const examRows = validRows.filter((r) => EXAM_TYPES.includes(r.examType));
  const assignmentRows = validRows.filter((r) => ASSIGNMENT_TYPES.includes(r.examType));

  const exam = buildChartData(examRows);
  const assignment = buildChartData(assignmentRows);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">성적 분석</h1>
        <p className="text-muted-foreground text-sm mt-1">
          과목별 성적 추이를 확인하세요
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-base font-semibold mb-6">시험 성적 추이</h2>
          <GradeChart data={exam.data} subjects={exam.subjects} />
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-base font-semibold mb-6">수행평가 성적 추이</h2>
          <GradeChart data={assignment.data} subjects={assignment.subjects} />
        </div>
      </div>
    </div>
  );
}
