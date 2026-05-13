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

export const subjectCategoryOptions = [
  "국어",
  "수학",
  "영어",
  "한국사",
  "사회",
  "과학",
  "탐구",
  "제2외국어",
  "예체능",
  "기타",
];

export function inferSubjectCategory(subjectName: string): string {
  if (/수학|대수|미적|기하|확률|통계/.test(subjectName)) return "수학";
  if (/국어|문학|독서|화법|언어|작문/.test(subjectName)) return "국어";
  if (/영어/.test(subjectName)) return "영어";
  if (/한국사/.test(subjectName)) return "한국사";
  if (/과학|물리|화학|생명|지구/.test(subjectName)) return "과학";
  if (/사회|역사|정치|경제|윤리|지리/.test(subjectName)) return "사회";
  if (/탐구/.test(subjectName)) return "탐구";
  if (/외국어|중국어|일본어|프랑스어|독일어|스페인어|한문/.test(subjectName)) return "제2외국어";
  if (/체육|음악|미술/.test(subjectName)) return "예체능";
  return "";
}
