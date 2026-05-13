"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";

function revalidateStudyViews() {
  revalidatePath("/analytics");
  revalidatePath("/analytics/[subject]", "page");
  revalidatePath("/strategy");
  revalidatePath("/dashboard");
}

async function resolveStudySubjectId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subjectId: string | null,
  subjectName: string | null,
) {
  if (subjectId) return subjectId;
  const resolvedSubjectName = subjectName?.trim() || "기타";

  const { data: existingSubject } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", resolvedSubjectName)
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
    .insert({ user_id: userId, semester_id: semesterId, name: resolvedSubjectName })
    .select("id")
    .single();

  if (subjectError) return null;
  return newSubject.id;
}

export async function addStudyLog(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectId = await resolveStudySubjectId(
    supabase,
    user.id,
    (formData.get("subject_id") as string | null) || null,
    ((formData.get("subject_name") as string | null) ?? "").trim() || null,
  );
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

  revalidateStudyViews();
  return { success: true };
}

export async function updateStudyLog(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const logId = formData.get("study_log_id") as string;
  const subjectId = await resolveStudySubjectId(
    supabase,
    user.id,
    (formData.get("subject_id") as string | null) || null,
    ((formData.get("subject_name") as string | null) ?? "").trim() || null,
  );
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

  revalidateStudyViews();
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

  revalidateStudyViews();
  return { success: true };
}

export async function addStudyTask(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectId = await resolveStudySubjectId(
    supabase,
    user.id,
    (formData.get("subject_id") as string | null) || null,
    ((formData.get("subject_name") as string | null) ?? "").trim() || null,
  );
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

  revalidateStudyViews();
  return { success: true };
}

export async function updateStudyTask(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const taskId = formData.get("study_task_id") as string;
  const subjectId = await resolveStudySubjectId(
    supabase,
    user.id,
    (formData.get("subject_id") as string | null) || null,
    ((formData.get("subject_name") as string | null) ?? "").trim() || null,
  );
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

  revalidateStudyViews();
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

  revalidateStudyViews();
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

  revalidateStudyViews();
  return { success: true };
}

export async function addRecommendationAsTask(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectId = (formData.get("subject_id") as string | null) || null;
  const title = ((formData.get("title") as string | null) ?? "").trim();
  const description = ((formData.get("description") as string | null) ?? "").trim();
  const priority = ((formData.get("priority") as string | null) ?? "medium") as "low" | "medium" | "high";

  if (!title || !description) {
    return { error: "추가할 전략 내용을 찾을 수 없습니다." };
  }

  const { error: recommendationError } = await supabase
    .from("learning_recommendations")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      recommendation_type: "strategy",
      title,
      description,
      priority,
    });

  if (recommendationError) {
    return { error: "전략 저장 중 오류가 발생했습니다." };
  }

  const { error: taskError } = await supabase.from("study_tasks").insert({
    user_id: user.id,
    subject_id: subjectId,
    title,
    task_type: "review",
    priority,
    memo: description,
    is_completed: false,
  });

  if (taskError) {
    return { error: "공부 할 일 추가 중 오류가 발생했습니다." };
  }

  revalidateStudyViews();
  return { success: true };
}
