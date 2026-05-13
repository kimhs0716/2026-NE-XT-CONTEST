import type { SubjectInsight } from "@/lib/analytics/types";

export type StudyFeedbackContext = {
  subject: string;
  logCount: number;
  totalMinutes: number;
  averageConcentration: number | null;
  hardLogCount: number;
  pendingTaskCount: number;
  highPriorityTaskCount: number;
  recentContents: string[];
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

export function buildFeedbackPrompt(
  insights: SubjectInsight[],
  studyContexts: StudyFeedbackContext[] = [],
): string {
  // 우선순위 높은 과목 먼저 정렬
  const sorted = [...insights].sort((a, b) => a.priority - b.priority);

  const subjectSummaries = sorted
    .map((s) => {
      const deltaStr =
        s.recentDelta !== null
          ? `최근 변화: ${s.recentDelta > 0 ? "+" : ""}${s.recentDelta}점`
          : "이전 비교 불가";
      return `- ${s.subject}: 평균 ${s.average}%, 최근 점수 ${s.latestScore}%, ${deltaStr}, 예측 ${s.predictedScore}%, 위험도 ${s.riskLevel}, 권장 행동: ${s.recommendedAction}`;
    })
    .join("\n");

  const studySummaries = studyContexts.length
    ? studyContexts
        .map((s) => {
          const concentration =
            s.averageConcentration !== null ? `${s.averageConcentration}/5` : "기록 없음";
          const contents = s.recentContents.length ? `, 최근 내용: ${s.recentContents.join(" / ")}` : "";
          return `- ${s.subject}: 최근 공부 기록 ${s.logCount}회, 총 ${formatMinutes(s.totalMinutes)}, 평균 집중도 ${concentration}, 어려움 기록 ${s.hardLogCount}회, 미완료 할 일 ${s.pendingTaskCount}개, 높은 우선순위 ${s.highPriorityTaskCount}개${contents}`;
        })
        .join("\n")
    : "최근 공부 기록 없음";

  return `너는 중고등학생을 위한 학습 코치다.

아래는 학생의 과목별 성적 분석 결과와 최근 공부 기록이다. 이 데이터를 바탕으로 학생에게 보여줄 짧은 피드백을 작성해라.

규칙:
- 예측 점수를 바꾸거나 다른 숫자를 언급하지 마라.
- 제공되지 않은 원인을 지어내지 마라.
- 제공된 분석 근거만 사용해라.
- 공부 시간이 부족한지, 집중도가 낮은지, 높은 우선순위 할 일이 남았는지 성적 흐름과 함께 판단해라.
- 전체적인 코멘트 1문장과, 주의가 필요한 과목 1~2개에 대한 구체적인 행동 지침을 포함해라.
- 총 3~4문장 이내로 작성해라.
- 과도하게 불안감을 주지 마라.
- 바로 실행 가능한 행동 하나를 포함해라.
- 존댓말로 작성해라.
- 마크다운 기호(**, ## 등)는 사용하지 마라.

과목별 분석:
${subjectSummaries}

최근 공부 기록:
${studySummaries}`;
}
