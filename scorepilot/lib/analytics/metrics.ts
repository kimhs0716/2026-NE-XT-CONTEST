import type { GradePoint, SubjectMetrics } from "./types";

export function computeMetrics(subject: string, grades: GradePoint[]): SubjectMetrics {
  if (grades.length === 0) {
    return {
      subject,
      count: 0,
      average: 0,
      latestScore: 0,
      previousScore: null,
      recentDelta: null,
      trend: "new",
      volatility: 0,
    };
  }

  const sorted = [...grades].sort((a, b) => a.semOrder - b.semOrder);
  const pcts = sorted.map((g) => g.percentage);
  const n = pcts.length;

  const average = Math.round((pcts.reduce((a, b) => a + b, 0) / n) * 10) / 10;
  const latestScore = pcts[n - 1];
  const previousScore = n > 1 ? pcts[n - 2] : null;
  const recentDelta =
    previousScore !== null
      ? Math.round((latestScore - previousScore) * 10) / 10
      : null;

  let trend: SubjectMetrics["trend"] = "new";
  if (recentDelta !== null) {
    if (recentDelta > 3) trend = "up";
    else if (recentDelta < -3) trend = "down";
    else trend = "stable";
  }

  const mean = pcts.reduce((a, b) => a + b, 0) / n;
  const variance = pcts.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  const volatility = Math.round(Math.sqrt(variance) * 10) / 10;

  return {
    subject,
    count: n,
    average,
    latestScore,
    previousScore,
    recentDelta,
    trend,
    volatility,
  };
}
