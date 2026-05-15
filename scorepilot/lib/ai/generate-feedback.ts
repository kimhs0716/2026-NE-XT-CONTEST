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
  const improving = sorted.filter((s) => s.recentDelta !== null && s.recentDelta > 0);

  // [집중]
  let focus: string;
  if (highRisk.length > 0) {
    const s = highRisk[0];
    const study = studyContexts.find((c) => c.subject === s.subject);
    const hint =
      study && study.totalMinutes > 0
        ? `오늘은 ${s.recommendedAction}부터 시작해 보세요.`
        : `먼저 학습 시간을 짧게 확보한 뒤 ${s.recommendedAction}부터 시작해 보세요.`;
    const second = highRisk.length > 1 ? ` ${highRisk[1].subject}도 함께 챙겨 보세요.` : "";
    focus = `[집중] ${s.subject}을 오늘 우선 점검하세요. ${hint}${second}`;
  } else if (declining.length > 0) {
    const s = declining[0];
    const study = studyContexts.find((c) => c.subject === s.subject);
    const hint =
      study && study.highPriorityTaskCount > 0
        ? `남아 있는 중요 할 일 ${study.highPriorityTaskCount}개를 먼저 정리해 보세요.`
        : `오늘 ${s.recommendedAction}을 20분만 시간을 내어 진행해 보세요.`;
    focus = `[집중] ${s.subject}의 최근 흐름을 점검할 때입니다. ${hint}`;
  } else {
    const s = sorted[0];
    focus = `[집중] ${s.subject}은 현재 흐름이 안정적입니다. 오늘은 ${s.recommendedAction}으로 꾸준히 유지해 보세요.`;
  }

  // [점검]
  let check: string;
  const noStudy = studyContexts.find(
    (c) => c.daysSinceLastStudy != null && c.daysSinceLastStudy >= 7,
  );
  if (noStudy) {
    check = `[점검] ${noStudy.subject} 학습 기록이 ${noStudy.daysSinceLastStudy}일째 없습니다. 이번 주 안에 짧게라도 기록을 남겨 보세요.`;
  } else if (declining.length > 1) {
    const s = declining[1];
    check = `[점검] ${s.subject}도 최근 하락세를 보이고 있어 이번 주 안에 한 번 확인이 필요합니다.`;
  } else if (improving.length > 0) {
    const s = improving[0];
    check = `[점검] ${s.subject}은 좋은 흐름을 이어가고 있으니 지금 방식을 유지해 보세요.`;
  } else {
    const s = sorted.length > 1 ? sorted[1] : sorted[0];
    check = `[점검] ${s.subject}의 오답이나 헷갈린 개념을 이번 주 안에 한 번 정리해 보세요.`;
  }

  // [응원]
  const encourage =
    improving.length > 0
      ? `[응원] 꾸준히 노력하는 모습이 분명히 결과로 이어질 거예요. 오늘도 잘 하고 있습니다.`
      : `[응원] 조금씩 쌓아 가는 것이 가장 큰 힘입니다. 오늘 하루도 응원합니다.`;

  return `${focus}\n\n${check}\n\n${encourage}`;
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
    const modelName = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
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
