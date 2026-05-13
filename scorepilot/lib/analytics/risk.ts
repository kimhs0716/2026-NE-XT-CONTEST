import type { RiskCause, SubjectMetrics, RiskAssessment } from "./types";

export function computeRisk(metrics: SubjectMetrics): RiskAssessment {
  const { count, average, recentDelta, volatility } = metrics;

  if (count < 2) {
    return {
      riskLevel: "insufficient",
      reasons: ["데이터 부족 — 기록이 쌓이면 분석이 시작됩니다"],
      causes: ["insufficient_data"],
    };
  }

  const causes: RiskCause[] = [];
  const reasons: string[] = [];
  if (recentDelta !== null && recentDelta <= -10) {
    causes.push("recent_drop");
    reasons.push("최근 성적이 10점 이상 하락");
  }
  if (average < 60) {
    causes.push("low_average");
    reasons.push("평균 점수 60점 미만");
  }
  if (volatility >= 15) {
    causes.push("high_volatility");
    reasons.push("성적 변동성이 큼");
  }

  if (causes.length > 0) {
    return { riskLevel: "high", reasons, causes };
  }

  if (recentDelta !== null && recentDelta < 0) {
    return { riskLevel: "medium", reasons: ["최근 성적 하락 중"], causes: ["recent_drop"] };
  }

  return { riskLevel: "low", reasons: ["안정적인 성적 유지 중"], causes: ["stable"] };
}
