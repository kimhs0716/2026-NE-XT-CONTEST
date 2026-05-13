import type { SubjectMetrics, RiskAssessment } from "./types";

export function computeRisk(metrics: SubjectMetrics): RiskAssessment {
  const { count, average, recentDelta } = metrics;

  if (count < 2) {
    return { riskLevel: "insufficient", reasons: ["데이터 부족 — 기록이 쌓이면 분석이 시작됩니다"] };
  }

  if (recentDelta !== null && recentDelta <= -10) {
    return { riskLevel: "high", reasons: ["최근 성적이 10점 이상 하락"] };
  }

  if (average < 60) {
    return { riskLevel: "high", reasons: ["평균 점수 60점 미만"] };
  }

  if (recentDelta !== null && recentDelta < 0) {
    return { riskLevel: "medium", reasons: ["최근 성적 하락 중"] };
  }

  return { riskLevel: "low", reasons: ["안정적인 성적 유지 중"] };
}
