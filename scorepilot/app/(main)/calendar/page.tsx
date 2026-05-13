import { createClient } from "@/lib/supabase/server";
import CalendarView, { type ScheduleEvent } from "@/components/calendar/CalendarView";

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

  const [{ data: scheduleRows }, { data: subjectRows }] = await Promise.all([
    supabase
      .from("schedules")
      .select(`
        id, title, event_type, start_date, is_completed, description,
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

  const schedules: ScheduleEvent[] = (scheduleRows as ScheduleRow[] ?? []).map((r) => {
    const subjectName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    return {
      id: r.id,
      date: r.start_date,
      title: r.title,
      eventType: r.event_type,
      isCompleted: r.is_completed,
      description: r.description ?? undefined,
      subjectName: subjectName ?? undefined,
    };
  });

  const subjects = (subjectRows ?? []).map((s) => s.name);

  return (
    <div className="px-[13vw] -my-8 h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      <div className="shrink-0 pt-6 pb-3">
        <h1 className="text-2xl font-bold">캘린더</h1>
        <p className="text-muted-foreground text-sm mt-1">
          시험·수행평가 일정을 확인하세요
        </p>
      </div>
      <div className="flex-1 min-h-0 pb-4">
        <CalendarView schedules={schedules} subjects={subjects} />
      </div>
    </div>
  );
}
