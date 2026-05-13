import type {
  SubjectMetrics,
  RiskAssessment,
  StudyStrategy,
  PredictionResult,
  SubjectInsight,
} from "./types";

export function buildInsight(
  metrics: SubjectMetrics,
  risk: RiskAssessment,
  strategy: StudyStrategy,
  prediction: PredictionResult,
): SubjectInsight {
  return {
    subject: metrics.subject,
    average: metrics.average,
    latestScore: metrics.latestScore,
    recentDelta: metrics.recentDelta,
    predictedScore: prediction.predictedScore,
    riskLevel: risk.riskLevel,
    priority: strategy.priority,
    mainReason: risk.reasons[0] ?? "분석 완료",
    recommendedAction: strategy.action,
  };
}
