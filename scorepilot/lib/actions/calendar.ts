"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";

function revalidateCalendarViews() {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/strategy");
}

async function findOrCreateSubjectId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
): Promise<string | null> {
  const subjectName = name.trim() || "기타";
  const { data: existingSubject } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", subjectName)
    .limit(1)
    .maybeSingle();

  if (existingSubject?.id) return existingSubject.id;

  const now = new Date();
  const semesterYear = now.getFullYear();
  const semesterType: SemesterType =
    now.getMonth() + 1 >= 3 && now.getMonth() + 1 <= 8 ? "semester_1" : "semester_2";

  const { data: existingSemester } = await supabase
    .from("semesters")
    .select("id")
    .eq("user_id", userId)
    .eq("year", semesterYear)
    .eq("semester_type", semesterType)
    .maybeSingle();

  let semesterId = existingSemester?.id as string | undefined;
  if (!semesterId) {
    const { data: newSemester, error: semesterError } = await supabase
      .from("semesters")
      .insert({
        user_id: userId,
        year: semesterYear,
        semester_type: semesterType,
        name: formatSemester(semesterYear, semesterType),
      })
      .select("id")
      .single();

    if (semesterError) return null;
    semesterId = newSemester.id;
  }

  const { data: newSubject, error: subjectError } = await supabase
    .from("subjects")
    .insert({ user_id: userId, semester_id: semesterId, name: subjectName })
    .select("id")
    .single();

  if (subjectError) return null;
  return newSubject.id;
}

export async function addSchedule(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const title = (formData.get("title") as string).trim();
  const eventType = formData.get("event_type") as string;
  const startDate = formData.get("start_date") as string;
  const description = ((formData.get("description") as string) || "").trim() || null;
  const subjectName = ((formData.get("subject_name") as string) || "").trim();

  if (!title) return { error: "제목을 입력해주세요." };
  if (!startDate) return { error: "날짜를 입력해주세요." };

  const subjectId = await findOrCreateSubjectId(supabase, user.id, subjectName);

  const { error } = await supabase.from("schedules").insert({
    user_id: user.id,
    subject_id: subjectId,
    title,
    event_type: eventType,
    start_date: startDate,
    description,
  });

  if (error) return { error: "일정 저장 중 오류가 발생했습니다." };

  revalidateCalendarViews();
  return { success: true };
}

export async function updateSchedule(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const scheduleId = formData.get("schedule_id") as string;
  const title = (formData.get("title") as string).trim();
  const eventType = formData.get("event_type") as string;
  const startDate = formData.get("start_date") as string;
  const description = ((formData.get("description") as string) || "").trim() || null;
  const subjectName = ((formData.get("subject_name") as string) || "").trim();

  if (!title) return { error: "제목을 입력해주세요." };
  if (!startDate) return { error: "날짜를 입력해주세요." };

  const subjectId = await findOrCreateSubjectId(supabase, user.id, subjectName);

  const { error } = await supabase
    .from("schedules")
    .update({ title, event_type: eventType, start_date: startDate, subject_id: subjectId, description })
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (error) return { error: "수정 중 오류가 발생했습니다." };

  revalidateCalendarViews();
  return { success: true };
}

export async function deleteSchedule(scheduleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidateCalendarViews();
  return { success: true };
}

export async function toggleScheduleComplete(scheduleId: string, isCompleted: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("schedules")
    .update({ is_completed: isCompleted })
    .eq("id", scheduleId)
    .eq("user_id", user.id);

  if (error) return { error: "업데이트 중 오류가 발생했습니다." };

  revalidateCalendarViews();
  return { success: true };
}
