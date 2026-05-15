import type { WeaknessDraft } from "./weakness";

export type RecommendationDraft = {
  subjectId: string;
  weaknessTitle: string;
  recommendationType: "review" | "practice" | "schedule" | "strategy";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
};

export function buildRecommendationDraft(weakness: WeaknessDraft): RecommendationDraft {
  const priority = weakness.severity >= 4 ? "high" : weakness.severity >= 3 ? "medium" : "low";

  if (weakness.weaknessType === "time_management") {
    return {
      subjectId: weakness.subjectId,
      weaknessTitle: weakness.title,
      recommendationType: "schedule",
      title: `${weakness.subject} 30분 학습 블록 만들기`,
      description: `${weakness.primaryReason}이 확인됐습니다. 오늘 30분 학습 시간을 먼저 확보하고 핵심 개념 1개와 대표 문제 5개를 처리하세요.`,
      priority,
    };
  }

  if (weakness.weaknessType === "habit") {
    return {
      subjectId: weakness.subjectId,
      weaknessTitle: weakness.title,
      recommendationType: "strategy",
      title: `${weakness.subject} 집중도 회복 루틴`,
      description: `${weakness.primaryReason}이 확인됐습니다. 25분 집중 학습 뒤 5분 쉬는 방식으로 짧게 끊어 복습하세요.`,
      priority,
    };
  }

  if (weakness.severity >= 4) {
    return {
      subjectId: weakness.subjectId,
      weaknessTitle: weakness.title,
      recommendationType: "review",
      title: `${weakness.subject} 오답 우선 복습`,
      description: `${weakness.primaryReason}이 확인됐습니다. 새 진도보다 최근 오답 유형을 30분 동안 먼저 정리하세요.`,
      priority,
    };
  }

  return {
    subjectId: weakness.subjectId,
    weaknessTitle: weakness.title,
    recommendationType: "practice",
    title: `${weakness.subject} 기본 문제 보강`,
    description: `${weakness.primaryReason}이 확인됐습니다. 기본 문제 10개를 풀고 틀린 유형만 짧게 정리하세요.`,
    priority,
  };
}
