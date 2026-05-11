"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  let subjectId: string | null = null;
  if (subjectName) {
    const { data: existing } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", subjectName)
      .single();

    if (existing) {
      subjectId = existing.id;
    } else {
      const { data: newSubject, error: subjectError } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, name: subjectName })
        .select("id")
        .single();
      if (subjectError) return { error: "과목 생성 중 오류가 발생했습니다." };
      subjectId = newSubject.id;
    }
  }

  const { error } = await supabase.from("schedules").insert({
    user_id: user.id,
    subject_id: subjectId,
    title,
    event_type: eventType,
    start_date: startDate,
    description,
  });

  if (error) return { error: "일정 저장 중 오류가 발생했습니다." };

  revalidatePath("/calendar");
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

  revalidatePath("/calendar");
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

  revalidatePath("/calendar");
  return { success: true };
}
