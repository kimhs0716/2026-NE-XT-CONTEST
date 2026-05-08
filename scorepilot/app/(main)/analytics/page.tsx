import { createClient } from "@/lib/supabase/server";
import GradeChart from "@/components/analytics/GradeChart";

type Row = {
  exam_date: string;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { percentage: number }[];
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("exams")
    .select(`
      exam_date,
      subjects ( name ),
      grade_records ( percentage )
    `)
    .eq("user_id", user!.id)
    .order("exam_date", { ascending: true });

  const validRows = (rows as Row[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const name = Array.isArray(r.subjects)
      ? r.subjects[0]?.name
      : r.subjects?.name;
    if (!name) return [];
    return [{ date: r.exam_date, subject: name, percentage: Number(pct) }];
  });

  const subjects = [...new Set(validRows.map((r) => r.subject))];

  const byDate = new Map<string, Record<string, number>>();
  for (const r of validRows) {
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    byDate.get(r.date)![r.subject] = r.percentage;
  }

  const chartData = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => ({ date, ...scores }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">성적 분석</h1>
        <p className="text-muted-foreground text-sm mt-1">
          과목별 성적 추이를 확인하세요
        </p>
      </div>
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-6">성적 추이</h2>
        <GradeChart data={chartData} subjects={subjects} />
      </div>
    </div>
  );
}
