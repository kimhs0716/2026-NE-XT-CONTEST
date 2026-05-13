export type RiskLevel = "insufficient" | "low" | "medium" | "high";

export type GradePoint = {
  percentage: number;
  semOrder: number;
};

export type SubjectMetrics = {
  subject: string;
  count: number;
  average: number;
  latestScore: number;
  previousScore: number | null;
  recentDelta: number | null;
  trend: "up" | "down" | "stable" | "new";
  volatility: number;
};

export type RiskAssessment = {
  riskLevel: RiskLevel;
  reasons: string[];
};

export type StudyStrategy = {
  priority: number;
  action: string;
};

export type PredictionResult = {
  predictedScore: number;
  confidence: number;
  basis: string;
};

export type SubjectInsight = {
  subject: string;
  average: number;
  latestScore: number;
  recentDelta: number | null;
  predictedScore: number;
  riskLevel: RiskLevel;
  priority: number;
  mainReason: string;
  recommendedAction: string;
};

export type SubjectAnalysis = {
  metrics: SubjectMetrics;
  risk: RiskAssessment;
  strategy: StudyStrategy;
};
