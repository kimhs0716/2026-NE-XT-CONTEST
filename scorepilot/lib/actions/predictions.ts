"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type GradePoint = { percentage: number; date: string };

function computePrediction(grades: GradePoint[]): {
  predicted: number;
  confidence: number;
  basis: string;
} | null {
  if (grades.length === 0) return null;

  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date));
  const scores = sorted.map((g) => g.percentage);
  const n = scores.length;

  if (n === 1) {
    return {
      predicted: Math.round(scores[0] * 10) / 10,
      confidence: 0.4,
      basis: "데이터 1개 — 기록이 쌓일수록 정확도가 높아집니다.",
    };
  }

  // 최신 기록에 높은 가중치 부여 (1, 2, 3, ... n)
  const totalWeight = (n * (n + 1)) / 2;
  const weightedAvg = scores.reduce((sum, s, i) => sum + s * (i + 1), 0) / totalWeight;

  // 최근 최대 5개 기록으로 선형 기울기 계산
  const window = scores.slice(-Math.min(n, 5));
  const wn = window.length;
  const xMean = (wn - 1) / 2;
  const yMean = window.reduce((a, b) => a + b, 0) / wn;
  const num = window.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0);
  const den = window.reduce((sum, _, x) => sum + (x - xMean) ** 2, 0);
  const slope = den !== 0 ? num / den : 0;

  // 예측값 = 가중 평균 + 트렌드 보정
  const raw = weightedAvg + slope * 0.6;
  const predicted = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;

  // 신뢰도: 분산이 낮고 데이터가 많을수록 높음
  const variance = scores.reduce((sum, s) => sum + (s - yMean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const baseConf = Math.max(0.35, 1 - stdDev / 60);
  const sampleBonus = Math.min(0.15, (n - 1) * 0.03);
  const confidence = Math.round(Math.min(0.95, baseConf + sampleBonus) * 100) / 100;

  const trendStr = slope > 3 ? "상승 추세 ↑" : slope < -3 ? "하락 추세 ↓" : "안정 추세 →";
  const basis = `${n}회 기록 분석 · ${trendStr} · 가중 평균 ${weightedAvg.toFixed(1)}%`;

  return { predicted, confidence, basis };
}

export async function generatePredictions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: rows } = await supabase
    .from("exams")
    .select(`
      exam_date,
      subjects ( id, name ),
      grade_records ( percentage )
    `)
    .eq("user_id", user.id)
    .order("exam_date", { ascending: true });

  if (!rows?.length) return { error: "성적 데이터가 없습니다." };

  const map = new Map<string, { name: string; grades: GradePoint[] }>();
  for (const r of rows) {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) continue;
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    if (!sub) continue;
    if (!map.has(sub.id)) map.set(sub.id, { name: sub.name, grades: [] });
    map.get(sub.id)!.grades.push({ percentage: Number(pct), date: r.exam_date });
  }

  // 기존 예측 전체 삭제 후 새로 삽입
  await supabase.from("score_predictions").delete().eq("user_id", user.id);

  const inserts = [];
  for (const [subjectId, { name, grades }] of map.entries()) {
    const result = computePrediction(grades);
    if (!result) continue;
    inserts.push({
      user_id: user.id,
      subject_id: subjectId,
      predicted_score: result.predicted,
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
  return { success: true };
}
