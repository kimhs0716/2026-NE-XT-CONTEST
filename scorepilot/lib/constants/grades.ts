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

export const commonSubjects = [
  "국어", "수학", "영어", "과학", "사회", "역사",
  "도덕", "체육", "음악", "미술", "기술가정", "정보",
];
