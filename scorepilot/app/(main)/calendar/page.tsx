import { createClient } from "@/lib/supabase/server";
import CalendarView, { type CalendarEvent } from "@/components/calendar/CalendarView";

type ExamRow = {
  id: string;
  exam_date: string;
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { percentage: number }[];
};

type ScheduleRow = {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  is_completed: boolean;
  description: string | null;
  subjects: { name: string } | { name: string }[] | null;
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: examRows }, { data: scheduleRows }, { data: subjectRows }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id,
        exam_date,
        exam_type,
        subjects ( name ),
        grade_records ( percentage )
      `)
      .eq("user_id", user!.id)
      .order("exam_date", { ascending: true }),
    supabase
      .from("schedules")
      .select(`
        id,
        title,
        event_type,
        start_date,
        is_completed,
        description,
        subjects ( name )
      `)
      .eq("user_id", user!.id)
      .order("start_date", { ascending: true }),
    supabase
      .from("subjects")
      .select("name")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  const gradeEvents: CalendarEvent[] = (examRows as ExamRow[] ?? []).flatMap((r) => {
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    const pct = r.grade_records[0]?.percentage ?? null;
    return [{
      id: r.id,
      date: r.exam_date,
      title: name,
      eventType: r.exam_type,
      percentage: pct !== null ? Number(pct) : null,
      isGrade: true,
      isCompleted: pct !== null,
    }];
  });

  const scheduleEvents: CalendarEvent[] = (scheduleRows as ScheduleRow[] ?? []).map((r) => {
    const subjectName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    return {
      id: r.id,
      date: r.start_date,
      title: r.title,
      eventType: r.event_type,
      percentage: null,
      isGrade: false,
      isCompleted: r.is_completed,
      description: r.description ?? undefined,
      subjectName: subjectName ?? undefined,
    };
  });

  const events = [...gradeEvents, ...scheduleEvents].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const subjects = (subjectRows ?? []).map((s) => s.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">캘린더</h1>
        <p className="text-muted-foreground text-sm mt-1">
          시험·수행평가 일정을 확인하세요
        </p>
      </div>
      <div className="rounded-xl border bg-white p-6">
        <CalendarView events={events} subjects={subjects} />
      </div>
    </div>
  );
}
