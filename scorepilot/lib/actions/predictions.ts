"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type SemesterType } from "@/lib/constants/grades";
import { computePrediction } from "@/lib/analytics/prediction";
import type { GradePoint } from "@/lib/analytics/types";

export async function generatePredictions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: rows } = await supabase
    .from("exams")
    .select(
      `subjects ( id, name ), semesters!exam_semester ( year, semester_type ), grade_records ( percentage )`,
    )
    .eq("user_id", user.id);

  if (!rows?.length) return { error: "성적 데이터가 없습니다." };

  const map = new Map<string, { name: string; grades: GradePoint[] }>();
  for (const r of rows) {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) continue;
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub) continue;
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) continue;
    const semOrder =
      sem.year * 10 +
      ((sem.semester_type as SemesterType) === "semester_2" ? 2 : 1);
    if (!map.has(sub.id)) map.set(sub.id, { name: sub.name, grades: [] });
    map.get(sub.id)!.grades.push({ percentage: Number(pct), semOrder });
  }

  await supabase.from("score_predictions").delete().eq("user_id", user.id);

  const inserts = [];
  for (const [subjectId, { name, grades }] of map.entries()) {
    const result = computePrediction(grades);
    if (!result) continue;
    inserts.push({
      user_id: user.id,
      subject_id: subjectId,
      predicted_score: result.predictedScore,
      prediction_target: `${name} 다음 시험`,
      model_type: "weighted_linear_trend",
      confidence: result.confidence,
      basis: result.basis,
    });
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("score_predictions").insert(inserts);
    if (error) return { error: "예측 저장 중 오류가 발생했습니다." };
  }

  revalidatePath("/analytics");
  revalidatePath("/analytics/[subject]", "page");
  revalidatePath("/strategy");
  revalidatePath("/dashboard");
  return { success: true };
}
