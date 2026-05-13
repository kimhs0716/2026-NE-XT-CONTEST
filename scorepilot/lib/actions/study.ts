"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addStudyLog(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectId = (formData.get("subject_id") as string | null) || null;
  const studyDate = formData.get("study_date") as string;
  const duration = parseInt(formData.get("duration_minutes") as string, 10);
  const difficulty = (formData.get("difficulty") as string | null) || null;
  const concentration = parseInt(formData.get("concentration_level") as string, 10);
  const content = ((formData.get("content") as string | null) ?? "").trim() || null;

  if (!studyDate) return { error: "공부 날짜를 입력해주세요." };
  if (Number.isNaN(duration) || duration < 0) {
    return { error: "공부 시간을 올바르게 입력해주세요." };
  }
  if (Number.isNaN(concentration) || concentration < 1 || concentration > 5) {
    return { error: "집중도는 1~5 사이로 입력해주세요." };
  }

  const { error } = await supabase.from("study_logs").insert({
    user_id: user.id,
    subject_id: subjectId,
    study_date: studyDate,
    duration_minutes: duration,
    difficulty,
    concentration_level: concentration,
    content,
  });

  if (error) return { error: "공부 기록 저장 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}

export async function updateStudyLog(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const logId = formData.get("study_log_id") as string;
  const subjectId = (formData.get("subject_id") as string | null) || null;
  const studyDate = formData.get("study_date") as string;
  const duration = parseInt(formData.get("duration_minutes") as string, 10);
  const difficulty = (formData.get("difficulty") as string | null) || null;
  const concentration = parseInt(formData.get("concentration_level") as string, 10);
  const content = ((formData.get("content") as string | null) ?? "").trim() || null;

  if (!logId) return { error: "수정할 공부 기록을 찾을 수 없습니다." };
  if (!studyDate) return { error: "공부 날짜를 입력해주세요." };
  if (Number.isNaN(duration) || duration < 0) {
    return { error: "공부 시간을 올바르게 입력해주세요." };
  }
  if (Number.isNaN(concentration) || concentration < 1 || concentration > 5) {
    return { error: "집중도는 1~5 사이로 입력해주세요." };
  }

  const { error } = await supabase
    .from("study_logs")
    .update({
      subject_id: subjectId,
      study_date: studyDate,
      duration_minutes: duration,
      difficulty,
      concentration_level: concentration,
      content,
    })
    .eq("id", logId)
    .eq("user_id", user.id);

  if (error) return { error: "공부 기록 수정 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}

export async function deleteStudyLog(logId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("study_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", user.id);

  if (error) return { error: "공부 기록 삭제 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}

export async function addStudyTask(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectId = (formData.get("subject_id") as string | null) || null;
  const title = ((formData.get("title") as string | null) ?? "").trim();
  const taskType = (formData.get("task_type") as string | null) || null;
  const dueDate = (formData.get("due_date") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || null;
  const memo = ((formData.get("memo") as string | null) ?? "").trim() || null;

  if (!title) return { error: "할 일 제목을 입력해주세요." };

  const { error } = await supabase.from("study_tasks").insert({
    user_id: user.id,
    subject_id: subjectId,
    title,
    task_type: taskType,
    due_date: dueDate,
    priority,
    memo,
    is_completed: false,
  });

  if (error) return { error: "공부 할 일 저장 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}

export async function updateStudyTask(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const taskId = formData.get("study_task_id") as string;
  const subjectId = (formData.get("subject_id") as string | null) || null;
  const title = ((formData.get("title") as string | null) ?? "").trim();
  const taskType = (formData.get("task_type") as string | null) || null;
  const dueDate = (formData.get("due_date") as string | null) || null;
  const priority = (formData.get("priority") as string | null) || null;
  const memo = ((formData.get("memo") as string | null) ?? "").trim() || null;

  if (!taskId) return { error: "수정할 공부 할 일을 찾을 수 없습니다." };
  if (!title) return { error: "할 일 제목을 입력해주세요." };

  const { error } = await supabase
    .from("study_tasks")
    .update({ subject_id: subjectId, title, task_type: taskType, due_date: dueDate, priority, memo })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) return { error: "공부 할 일 수정 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}

export async function deleteStudyTask(taskId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("study_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) return { error: "공부 할 일 삭제 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}

export async function toggleStudyTaskComplete(taskId: string, isCompleted: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("study_tasks")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) return { error: "공부 할 일 상태 변경 중 오류가 발생했습니다." };

  revalidatePath("/analytics");
  return { success: true };
}
