"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateViews() {
  revalidatePath("/strategy");
  revalidatePath("/analytics");
  revalidatePath("/dashboard");
}

export async function convertRecommendationToTask(recommendationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: recommendation, error: fetchError } = await supabase
    .from("learning_recommendations")
    .select("id, subject_id, title, description, priority")
    .eq("id", recommendationId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !recommendation) {
    return { error: "추천을 찾을 수 없습니다." };
  }

  const { error } = await supabase.from("study_tasks").insert({
    user_id: user.id,
    subject_id: recommendation.subject_id,
    title: recommendation.title,
    task_type: "review",
    priority: recommendation.priority ?? "medium",
    memo: recommendation.description,
    is_completed: false,
  });

  if (error) return { error: "할 일 추가 중 오류가 발생했습니다." };

  revalidateViews();
  return { success: true };
}
