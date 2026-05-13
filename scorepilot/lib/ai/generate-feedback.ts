import { GoogleGenAI } from "@google/genai";
import type { SubjectInsight } from "@/lib/analytics/types";
import type { StudyFeedbackContext } from "@/lib/ai/prompt";
import {
  STUDENT_COACH_GENERATION_CONFIG,
  STUDENT_COACH_SYSTEM_PROMPT,
} from "@/lib/ai/system-prompt";

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
    const studyHint =
      study && study.totalMinutes > 0
        ? ` 최근 공부 기록은 ${study.totalMinutes}분입니다.`
        : " 최근 공부 기록이 적어 먼저 학습 시간을 남겨두는 것이 좋습니다.";
    parts.push(
      `${s.subject}은 이번 주에 먼저 확인할 필요가 있습니다.${studyHint} 오늘은 ${s.recommendedAction}부터 진행해 보세요.`,
    );
    if (highRisk.length > 1) {
      const s2 = highRisk[1];
      parts.push(`${s2.subject}도 시간이 남으면 짧게 점검해 보세요.`);
    }
  } else if (declining.length > 0) {
    const s = declining[0];
    const study = studyContexts.find((context) => context.subject === s.subject);
    const taskHint =
      study && study.highPriorityTaskCount > 0
        ? ` 먼저 남아 있는 중요 할 일 ${study.highPriorityTaskCount}개를 정리해 보세요.`
        : " 실수 유형을 확인한 뒤 짧게 복습해 보세요.";
    parts.push(
      `${s.subject}은 최근 흐름을 한 번 점검하면 좋겠습니다.${taskHint}`,
    );
  } else if (improving.length > 0) {
    const s = improving[0];
    parts.push(
      `${s.subject}은 최근 흐름이 좋아지고 있습니다. 오늘은 지금 방식은 유지하되, 틀린 문제를 5개만 다시 확인해 보세요.`,
    );
  } else {
    const s = sorted[0];
    parts.push(
      `${s.subject}은 현재 흐름이 비교적 안정적입니다. 오늘은 오답이나 헷갈린 개념을 20분만 확인해 보세요.`,
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
      config: {
        ...STUDENT_COACH_GENERATION_CONFIG,
        systemInstruction: STUDENT_COACH_SYSTEM_PROMPT,
      },
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
