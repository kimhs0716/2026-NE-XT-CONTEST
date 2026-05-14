import type { RiskLevel } from "./types";

export type WeaknessSignal = {
  subjectId: string;
  subject: string;
  average: number;
  latestScore: number;
  recentDelta: number | null;
  riskLevel: RiskLevel;
  riskReason: string;
  targetScore: number | null;
  targetGap: number | null;
  study7m: number;
  concentration14: number | null;
  pendingTasks: number;
  dueSoonTasks: number;
  overdueTasks: number;
  examDaysLeft: number | null;
};

export type WeaknessDraft = {
  subjectId: string;
  subject: string;
  weaknessType: "subject" | "habit" | "time_management";
  title: string;
  description: string;
  severity: number;
  evidence: string;
  primaryReason: string;
};

function clampSeverity(value: number): number {
  return Math.min(5, Math.max(1, value));
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "-";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

export function targetMinutesForRisk(riskLevel: RiskLevel, examDaysLeft: number | null): number {
  let target = riskLevel === "high" ? 180 : riskLevel === "medium" ? 120 : 60;
  if (examDaysLeft !== null && examDaysLeft <= 7) target *= 1.5;
  if (examDaysLeft !== null && examDaysLeft <= 3) target *= 2;
  return target;
}

export function buildWeaknessDraft(signal: WeaknessSignal): WeaknessDraft | null {
  const targetMinutes = targetMinutesForRisk(signal.riskLevel, signal.examDaysLeft);
  const reasons: string[] = [];
  let severity = 0;
  let weaknessType: WeaknessDraft["weaknessType"] = "subject";

  if (signal.average < 70) {
    severity += 1;
    reasons.push(`평균 ${signal.average}점`);
  }
  if (signal.average < 60) {
    severity += 1;
    reasons.push("평균 60점 미만");
  }
  if (signal.recentDelta !== null && signal.recentDelta <= -5) {
    severity += 1;
    reasons.push(`최근 ${Math.abs(signal.recentDelta)}점 하락`);
  }
  if (signal.recentDelta !== null && signal.recentDelta <= -10) {
    severity += 1;
  }
  if (signal.targetGap !== null && signal.targetGap >= 10) {
    severity += 1;
    reasons.push(`목표까지 ${signal.targetGap}점 부족`);
  }
  if (signal.targetGap !== null && signal.targetGap >= 20) {
    severity += 1;
  }
  if (signal.study7m === 0) {
    severity += 2;
    weaknessType = "time_management";
    reasons.push("최근 7일 공부 기록 0분");
  } else if (signal.study7m < targetMinutes * 0.5) {
    severity += 1;
    weaknessType = "time_management";
    reasons.push(`최근 7일 공부 ${signal.study7m}분`);
  }
  if (signal.concentration14 !== null && signal.concentration14 < 3) {
    severity += 1;
    weaknessType = "habit";
    reasons.push(`집중도 평균 ${signal.concentration14.toFixed(1)}점`);
  }
  if (signal.examDaysLeft !== null && signal.examDaysLeft <= 7) {
    severity += 1;
    reasons.push(`시험 D-${signal.examDaysLeft}`);
  }
  if (signal.examDaysLeft !== null && signal.examDaysLeft <= 3) {
    severity += 1;
  }
  if (signal.dueSoonTasks >= 2) {
    severity += 1;
    reasons.push(`마감 임박 할 일 ${signal.dueSoonTasks}개`);
  }
  if (signal.overdueTasks >= 1) {
    severity += 2;
    reasons.push(`마감 지난 할 일 ${signal.overdueTasks}개`);
  }

  if (severity <= 0 && signal.riskLevel === "low") return null;
  if (reasons.length === 0) reasons.push(signal.riskReason || "기록이 더 필요합니다");

  const finalSeverity = clampSeverity(severity || 1);
  const primaryReason = reasons[0];
  const evidence = [
    `latest=${signal.latestScore}`,
    `avg=${signal.average}`,
    `delta=${formatDelta(signal.recentDelta)}`,
    `goalGap=${signal.targetGap ?? "-"}`,
    `study7m=${signal.study7m}`,
    `conc14=${signal.concentration14?.toFixed(1) ?? "-"}`,
    `tasksDue=${signal.dueSoonTasks}`,
    `overdue=${signal.overdueTasks}`,
    `examD=${signal.examDaysLeft ?? "-"}`,
  ].join(", ");

  return {
    subjectId: signal.subjectId,
    subject: signal.subject,
    weaknessType,
    title: `${signal.subject} 보강 필요`,
    description: `${signal.subject}은 ${reasons.slice(0, 3).join(", ")} 때문에 이번 주 우선 관리가 필요합니다.`,
    severity: finalSeverity,
    evidence,
    primaryReason,
  };
}
