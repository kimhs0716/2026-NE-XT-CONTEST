"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function upsertMockExamRecord(_: unknown, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다." };

    const examYear = parseInt(formData.get("exam_year") as string, 10);
    const examMonth = parseInt(formData.get("exam_month") as string, 10);
    const subject = (formData.get("subject") as string)?.trim();
    const rawScoreStr = formData.get("raw_score") as string;
    const percentileStr = formData.get("percentile") as string;
    const gradeStr = formData.get("grade") as string;
    const targetScoreStr = formData.get("target_score") as string;

    if (!examYear || !examMonth || !subject) return { error: "필수 항목을 입력해주세요." };

    const raw_score = rawScoreStr ? parseInt(rawScoreStr, 10) : null;
    const percentile = percentileStr ? parseFloat(percentileStr) : null;
    const grade = gradeStr ? parseInt(gradeStr, 10) : null;
    const target_score = targetScoreStr ? parseInt(targetScoreStr, 10) : null;

    const { error } = await supabase
      .from("mock_exam_records")
      .upsert(
        { user_id: user.id, exam_year: examYear, exam_month: examMonth, subject, raw_score, percentile, grade, target_score },
        { onConflict: "user_id,exam_year,exam_month,subject" }
      );

    if (error) { console.error("[upsertMockExamRecord]", error); return { error: "저장 중 오류가 발생했습니다." }; }

    revalidatePath("/mock-exam");
    return { success: true };
  } catch (e) {
    console.error("[upsertMockExamRecord]", e);
    return { error: "저장 중 오류가 발생했습니다." };
  }
}

export async function deleteMockExamRecord(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("mock_exam_records").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/mock-exam");
}
