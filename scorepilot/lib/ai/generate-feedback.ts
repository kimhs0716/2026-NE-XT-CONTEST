import { GoogleGenAI } from "@google/genai";
import type { SubjectInsight } from "@/lib/analytics/types";
import type { StudyFeedbackContext } from "@/lib/ai/prompt";

export type FeedbackResult = {
  source: "llm" | "fallback";
  text: string;
  isQuotaError: boolean;
};

function generateFallbackFeedback(
  insights: SubjectInsight[],
  studyContexts: StudyFeedbackContext[] = [],
): string {
  const sorted = [...insights].sort((a, b) => a.priority - b.priority);
  const highRisk = sorted.filter((s) => s.riskLevel === "high");
  const declining = sorted.filter(
    (s) => s.riskLevel !== "high" && s.recentDelta !== null && s.recentDelta < 0,
  );
  const improving = sorted.filter(
    (s) => s.recentDelta !== null && s.recentDelta > 0,
  );

  const parts: string[] = [];

  if (highRisk.length > 0) {
    const s = highRisk[0];
    const study = studyContexts.find((context) => context.subject === s.subject);
    const concentration = study?.averageConcentration != null ? `${study.averageConcentration}` : "기록 없음";
    const studyHint =
      study && study.totalMinutes > 0
        ? ` 최근 공부 기록은 총 ${study.totalMinutes}분, 평균 집중도 ${concentration}/5입니다.`
        : " 최근 공부 기록이 부족하니 학습 시간을 먼저 기록해보세요.";
    parts.push(
      `${s.subject} 과목은 최근 성적 흐름상 주의가 필요합니다.${studyHint} 다음 시험 예상 점수는 ${s.predictedScore}%이며, ${s.recommendedAction}을 우선적으로 진행하는 것이 좋습니다.`,
    );
    if (highRisk.length > 1) {
      const s2 = highRisk[1];
      parts.push(`${s2.subject} 과목도 함께 점검하는 것을 권장합니다.`);
    }
  } else if (declining.length > 0) {
    const s = declining[0];
    const study = studyContexts.find((context) => context.subject === s.subject);
    const taskHint =
      study && study.highPriorityTaskCount > 0
        ? ` 높은 우선순위 할 일 ${study.highPriorityTaskCount}개를 먼저 끝내세요.`
        : " 실수 유형 점검과 복습을 병행하는 것이 좋습니다.";
    parts.push(
      `${s.subject} 과목은 최근 점수가 다소 하락했습니다. 다음 시험 예상 점수는 ${s.predictedScore}%입니다.${taskHint}`,
    );
  } else if (improving.length > 0) {
    const s = improving[0];
    parts.push(
      `${s.subject} 과목은 최근 성적이 상승세입니다. 다음 시험 예상 점수는 ${s.predictedScore}%이며, 현재 학습 방식을 유지하면서 부족한 부분을 보완하는 것이 좋습니다.`,
    );
  } else {
    const s = sorted[0];
    parts.push(
      `${s.subject} 과목은 현재 성적이 비교적 안정적입니다. 다음 시험 예상 점수는 ${s.predictedScore}%이며, 기존 학습 흐름을 유지하는 것이 좋습니다.`,
    );
  }

  return parts.join(" ");
}

export async function generateFeedbackWithFallback(
  prompt: string,
  insights: SubjectInsight[],
  studyContexts: StudyFeedbackContext[] = [],
): Promise<FeedbackResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      source: "fallback",
      text: generateFallbackFeedback(insights, studyContexts),
      isQuotaError: false,
    };
  }

  try {
    const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });
    return {
      source: "llm",
      text: response.text?.trim() ?? "",
      isQuotaError: false,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    const isQuota =
      error instanceof Error &&
      (error.message.includes("429") ||
        error.message.toLowerCase().includes("quota"));
    return {
      source: "fallback",
      text: generateFallbackFeedback(insights, studyContexts),
      isQuotaError: isQuota,
    };
  }
}
