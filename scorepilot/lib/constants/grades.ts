export type ExamType = "midterm" | "final" | "assignment" | "mock_exam" | "other";

export type SemesterType = "semester_1" | "semester_2";

export const semesterTypeLabels: Record<SemesterType, string> = {
  semester_1: "1학기",
  semester_2: "2학기",
};

export function formatSemester(year: number, type: SemesterType): string {
  return `${year}년 ${semesterTypeLabels[type]}`;
}

export const examTypeLabels: Record<ExamType, string> = {
  midterm: "중간고사",
  final: "기말고사",
  assignment: "수행평가",
  mock_exam: "모의고사",
  other: "기타",
};

export const examTypeGroups = [
  {
    label: "시험",
    types: ["midterm", "final", "mock_exam"] as ExamType[],
  },
  {
    label: "수행평가",
    types: ["assignment"] as ExamType[],
  },
  {
    label: "기타",
    types: ["other"] as ExamType[],
  },
];

export const preferredSubjectOrder = ["국어", "수학", "영어", "사회", "과학"];

export const commonSubjects = [...preferredSubjectOrder];

export function compareSubjectNames(a: string, b: string): number {
  const rankA = preferredSubjectOrder.indexOf(a);
  const rankB = preferredSubjectOrder.indexOf(b);

  if (rankA !== -1 || rankB !== -1) {
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  }

  return a.localeCompare(b, "ko");
}

export function sortSubjectsByPreferredOrder(subjects: string[]): string[] {
  return [...new Set(subjects)].sort(compareSubjectNames);
}
