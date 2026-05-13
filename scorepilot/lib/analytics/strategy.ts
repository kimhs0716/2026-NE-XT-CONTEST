import type { SubjectMetrics, RiskAssessment, StudyStrategy } from "./types";

export function computeStrategy(
  metrics: SubjectMetrics,
  risk: RiskAssessment,
): StudyStrategy {
  const { average, trend } = metrics;
  const { riskLevel } = risk;

  const priority = riskLevel === "high" ? 1 : riskLevel === "medium" ? 2 : 3;

  let action: string;

  if (riskLevel === "high" && trend === "down") {
    action = "새 진도보다 최근 오답 유형 복습 우선";
  } else if (riskLevel === "high") {
    action = "기초 개념부터 체계적으로 복습";
  } else if (average >= 80 && trend === "down") {
    action = "실수 유형 점검과 시험 직전 복습 필요";
  } else if (average < 60 && trend === "up") {
    action = "현재 학습 방식 유지 + 부족 단원 보완";
  } else if (riskLevel === "medium") {
    action = "취약 단원 집중 보완";
  } else if (riskLevel === "insufficient") {
    action = "성적 기록을 더 추가하면 맞춤 전략이 생성됩니다";
  } else {
    action = "유지 학습 중심으로 꾸준히 복습";
  }

  return { priority, action };
}
