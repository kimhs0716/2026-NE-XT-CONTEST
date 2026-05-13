"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertSubjectGoal(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectId = formData.get("subject_id") as string;
  const subjectName = formData.get("subject_name") as string;
  const targetScore = parseFloat(formData.get("target_score") as string);
  const targetDate = (formData.get("target_date") as string | null) || null;
  const memo = ((formData.get("memo") as string | null) ?? "").trim() || null;

  if (!subjectId) return { error: "과목 정보를 찾을 수 없습니다." };
  if (Number.isNaN(targetScore) || targetScore < 0 || targetScore > 100) {
    return { error: "목표 점수는 0~100 사이로 입력해주세요." };
  }

  const { data: existing } = await supabase
    .from("subject_goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .limit(1)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    subject_id: subjectId,
    target_score: targetScore,
    target_date: targetDate,
    memo,
  };

  const { error } = existing
    ? await supabase
        .from("subject_goals")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id)
    : await supabase.from("subject_goals").insert(payload);

  if (error) return { error: "목표 저장 중 오류가 발생했습니다." };

  revalidatePath("/grades");
  revalidatePath("/grades/[subject]", "page");
  revalidatePath("/analytics");
  revalidatePath("/strategy");
  if (subjectName) {
    revalidatePath(`/grades/${encodeURIComponent(subjectName)}`);
  }

  return { success: true };
}
