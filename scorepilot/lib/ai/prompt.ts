import type { SubjectInsight } from "@/lib/analytics/types";

export type StudyFeedbackContext = {
  subject: string;
  category: string | null;
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
  daysSinceLastStudy: number | null;
  recentContents: string[];
};

export type SchoolLevel = "middle" | "high" | null;

export type MockExamSummary = {
  latestExam: string | null;
  averageGrade: number | null;
  weakSubjects: string[];
  targetGaps: string[];
};

function valueOrDash(value: number | null | undefined): string {
  return value == null ? "-" : String(value);
}

function signed(value: number | null): string {
  if (value == null) return "-";
  return value > 0 ? `+${value}` : String(value);
}

function riskCode(riskLevel: SubjectInsight["riskLevel"]): string {
  if (riskLevel === "high") return "H";
  if (riskLevel === "medium") return "M";
  if (riskLevel === "low") return "L";
  return "N";
}

function summarizeContents(contents: string[]): string {
  return contents
    .slice(0, 3)
    .map((content) => content.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" / ")
    .slice(0, 120);
}

export function buildFeedbackPrompt(
  insights: SubjectInsight[],
  studyContexts: StudyFeedbackContext[] = [],
  schoolLevel: SchoolLevel = null,
  mockExamSummary: MockExamSummary | null = null,
): string {
  const studyBySubject = new Map(studyContexts.map((s) => [s.subject, s]));
  const sorted = [...insights].sort((a, b) => a.priority - b.priority);

  const lines = sorted.map((s) => {
    const study = studyBySubject.get(s.subject);
    const contents = summarizeContents(study?.recentContents ?? []);
    return [
      `sub=${s.subject}`,
      study?.category ? `cat=${study.category}` : null,
      `avg=${s.average}`,
      `last=${s.latestScore}`,
      `delta=${signed(s.recentDelta)}`,
      `pred=${valueOrDash(s.predictedScore)}`,
      `risk=${riskCode(s.riskLevel)}`,
      `goal=${valueOrDash(study?.targetScore)}`,
      `gap=${signed(study?.targetGap ?? null)}`,
      `min=${study?.totalMinutes ?? 0}`,
      `conc=${valueOrDash(study?.averageConcentration)}`,
      `hard=${study?.hardLogCount ?? 0}`,
      `tasks=${study?.pendingTaskCount ?? 0}`,
      `hiTasks=${study?.highPriorityTaskCount ?? 0}`,
      `examD=${valueOrDash(study?.nearestScheduleDays)}`,
      study?.daysSinceLastStudy != null ? `noStudy=${study.daysSinceLastStudy}d` : null,
      `action=${s.recommendedAction}`,
      contents ? `recent=${contents}` : null,
    ]
      .filter(Boolean)
      .join(" ");
  });

  const school = schoolLevel === "high" ? "high" : schoolLevel === "middle" ? "middle" : "unknown";
  const mockLine =
    schoolLevel === "high" && mockExamSummary
      ? [
          mockExamSummary.latestExam ? `latest=${mockExamSummary.latestExam}` : null,
          mockExamSummary.averageGrade != null ? `avgGrade=${mockExamSummary.averageGrade}` : null,
          mockExamSummary.weakSubjects.length > 0 ? `weak=${mockExamSummary.weakSubjects.join(",")}` : null,
          mockExamSummary.targetGaps.length > 0 ? `gap=${mockExamSummary.targetGaps.join(",")}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  return `아래 DATA만 근거로 학습 피드백을 작성하세요.
숫자는 꼭 필요한 1~2개만 인용하세요.
level은 조언 범위 선택에만 참고하고, 답변에 직접 쓰지 마세요.
risk H=보완 필요, M=관리 필요, L=흐름 양호, N=자료 부족입니다. 이 코드명은 답변에 쓰지 마세요.
gap은 목표까지 남은 점수이며 음수면 목표 초과입니다.
level=${school}
MOCK:${mockLine || "-"}
DATA:
${lines.join("\n")}`;
}
