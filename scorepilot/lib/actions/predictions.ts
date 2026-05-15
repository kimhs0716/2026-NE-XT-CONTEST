"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type SemesterType } from "@/lib/constants/grades";
import { computePrediction } from "@/lib/analytics/prediction";
import type { GradePoint } from "@/lib/analytics/types";

function subjectCategory(name: string): string {
  const idx = name.indexOf("(");
  return idx > 0 ? name.slice(0, idx) : name;
}

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

  const subjectMap = new Map<string, { name: string; grades: GradePoint[] }>();
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
    if (!subjectMap.has(sub.id)) subjectMap.set(sub.id, { name: sub.name, grades: [] });
    subjectMap.get(sub.id)!.grades.push({ percentage: Number(pct), semOrder });
  }

  // 분류별 학기당 평균으로 집계 (같은 학기에 같은 분류 과목 여러 개면 평균)
  const categoryAccum = new Map<string, Map<number, number[]>>();
  for (const { name, grades } of subjectMap.values()) {
    const cat = subjectCategory(name);
    if (!categoryAccum.has(cat)) categoryAccum.set(cat, new Map());
    const semMap = categoryAccum.get(cat)!;
    for (const g of grades) {
      if (!semMap.has(g.semOrder)) semMap.set(g.semOrder, []);
      semMap.get(g.semOrder)!.push(g.percentage);
    }
  }

  const categoryGrades = new Map<string, GradePoint[]>();
  for (const [cat, semMap] of categoryAccum.entries()) {
    const points = [...semMap.entries()].map(([semOrder, scores]) => ({
      semOrder,
      percentage: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));
    categoryGrades.set(cat, points);
  }

  await supabase.from("score_predictions").delete().eq("user_id", user.id);

  const inserts = [];
  for (const [subjectId, { name }] of subjectMap.entries()) {
    const cat = subjectCategory(name);
    const trainingData = categoryGrades.get(cat) ?? [];
    const result = computePrediction(trainingData);
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
