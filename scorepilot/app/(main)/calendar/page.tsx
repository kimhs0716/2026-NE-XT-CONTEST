import { createClient } from "@/lib/supabase/server";
import CalendarView, { type CalendarEvent } from "@/components/calendar/CalendarView";
import { type ExamType } from "@/lib/constants/grades";

type Row = {
  exam_date: string;
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { percentage: number }[];
};

export default async function CalendarPage() {
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

  const events: CalendarEvent[] = (rows as Row[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    return [{
      date: r.exam_date,
      subject: name,
      examType: r.exam_type as ExamType,
      percentage: pct ?? 0,
    }];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">캘린더</h1>
        <p className="text-muted-foreground text-sm mt-1">
          시험·수행평가 일정을 확인하세요
        </p>
      </div>
      <div className="rounded-xl border bg-white p-6">
        <CalendarView events={events} />
      </div>
    </div>
  );
}
