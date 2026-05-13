import type { SubjectInsight } from "@/lib/analytics/types";

export type StudyFeedbackContext = {
  subject: string;
  targetScore: number | null;
  targetGap: number | null;
  logCount: number;
  totalMinutes: number;
  averageConcentration: number | null;
  hardLogCount: number;
  pendingTaskCount: number;
  highPriorityTaskCount: number;
  upcomingScheduleCount: number;
  nearestScheduleDays: number | null;
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
  const studyBySubject = new Map(studyContexts.map((s) => [s.subject, s]));
  const sorted = [...insights]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);

  const subjectSummaries = sorted
    .map((s) => {
      const study = studyBySubject.get(s.subject);
      const deltaStr =
        s.recentDelta !== null
          ? `변화 ${s.recentDelta > 0 ? "+" : ""}${s.recentDelta}`
          : "변화 -";
      const target = study?.targetScore != null
        ? `목표 ${study.targetScore}, 차이 ${study.targetGap != null && study.targetGap > 0 ? "+" : ""}${study.targetGap}`
        : "목표 -";
      const concentration = study?.averageConcentration != null ? study.averageConcentration : "-";
      const schedule = study?.nearestScheduleDays != null ? `D-${study.nearestScheduleDays}` : "-";
      return `${s.subject}: 평균 ${s.average}, 최근 ${s.latestScore}, ${deltaStr}, 예측 ${s.predictedScore}, 위험 ${s.riskLevel}, ${target}, 공부 ${formatMinutes(study?.totalMinutes ?? 0)}, 집중 ${concentration}, 할일 ${study?.pendingTaskCount ?? 0}, 일정 ${schedule}, 행동 ${s.recommendedAction}`;
    })
    .join("\n");

  return `중고등학생 학습 코치로 답하세요.
규칙: 아래 수치만 사용, 새 원인 추측 금지, 3문장 이내, 존댓말, 마크다운 금지, 바로 할 행동 1개 포함.
데이터(우선순위 상위 4개):
${subjectSummaries}`;
}
