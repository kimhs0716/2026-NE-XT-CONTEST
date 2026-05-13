import type { GradePoint, PredictionResult } from "./types";

export function computePrediction(grades: GradePoint[]): PredictionResult | null {
  if (grades.length === 0) return null;

  const sorted = [...grades].sort((a, b) => a.semOrder - b.semOrder);
  const scores = sorted.map((g) => g.percentage);
  const n = scores.length;

  if (n === 1) {
    return {
      predictedScore: Math.round(scores[0] * 10) / 10,
      confidence: 0.4,
      basis: "데이터 1개 — 기록이 쌓일수록 정확도가 높아집니다.",
    };
  }

  // 최근 성적에 더 높은 가중치 (i+1)
  const totalWeight = (n * (n + 1)) / 2;
  const weightedAvg =
    scores.reduce((sum, s, i) => sum + s * (i + 1), 0) / totalWeight;

  // 최근 5개 기준 선형 추세 (slope)
  const window = scores.slice(-Math.min(n, 5));
  const wn = window.length;
  const xMean = (wn - 1) / 2;
  const yMean = window.reduce((a, b) => a + b, 0) / wn;
  const num = window.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0);
  const den = window.reduce((sum, _, x) => sum + (x - xMean) ** 2, 0);
  const slope = den !== 0 ? num / den : 0;

  const raw = weightedAvg + slope * 0.6;
  const predictedScore = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;

  // 변동성 기반 신뢰도
  const variance = scores.reduce((sum, s) => sum + (s - yMean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const baseConf = Math.max(0.35, 1 - stdDev / 60);
  const sampleBonus = Math.min(0.15, (n - 1) * 0.03);
  const confidence =
    Math.round(Math.min(0.95, baseConf + sampleBonus) * 100) / 100;

  const trendStr =
    slope > 3 ? "상승 추세 ↑" : slope < -3 ? "하락 추세 ↓" : "안정 추세 →";
  const basis = `${n}회 기록 분석 · ${trendStr} · 가중 평균 ${weightedAvg.toFixed(1)}%`;

  return { predictedScore, confidence, basis };
}
