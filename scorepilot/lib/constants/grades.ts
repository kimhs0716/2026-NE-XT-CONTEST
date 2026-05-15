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

// 학교급별 과목 목록
export const MIDDLE_SCHOOL_SUBJECTS = [
  "국어", "수학", "영어", "사회", "과학", "도덕", "음악", "미술", "체육", "기술가정", "정보",
];

export const HIGH_SCHOOL_SUBJECTS = [
  "국어", "수학", "영어", "한국사", "사회탐구", "과학탐구", "체육", "음악", "정보", "제2외국어",
];

export function getSubjectsBySchoolLevel(
  schoolLevel: "middle" | "high" | null | undefined,
): string[] {
  if (schoolLevel === "high") return HIGH_SCHOOL_SUBJECTS;
  return MIDDLE_SCHOOL_SUBJECTS;
}

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

// 이수점 계산: Σ(percentage × weight / 100), 반영비 합계가 100이 되어야 함
export function calcWeightedScore(
  exams: { percentage: number; weight: number }[],
): number {
  return (
    Math.round(
      exams.reduce((sum, e) => sum + (e.percentage * e.weight) / 100, 0) * 100,
    ) / 100
  );
}

// 중학교 내신 성취도 (이수점 기반)
export function calcMiddleSchoolGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "E";
}

// 고등학교 내신 절대평가 등급 (이수점 기반)
export function calcHighSchoolAbsoluteGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  return "C";
}

// 모의고사 상대평가 등급 (백분위 기반, 상위 누적 % 기준)
export function calcMockExamRelativeGrade(percentile: number): number {
  if (percentile >= 96) return 1;
  if (percentile >= 89) return 2;
  if (percentile >= 77) return 3;
  if (percentile >= 60) return 4;
  if (percentile >= 40) return 5;
  if (percentile >= 23) return 6;
  if (percentile >= 11) return 7;
  if (percentile >= 4) return 8;
  return 9;
}

// 모의고사 영어 등급 (원점수 기반: 90/80/70/60/50/40/30/20 기준)
export function calcMockExamEnglishGrade(score: number): number {
  if (score >= 90) return 1;
  if (score >= 80) return 2;
  if (score >= 70) return 3;
  if (score >= 60) return 4;
  if (score >= 50) return 5;
  if (score >= 40) return 6;
  if (score >= 30) return 7;
  if (score >= 20) return 8;
  return 9;
}

// 모의고사 한국사/제2외국어 등급 (원점수 기반: 40/35/30/25/20/15/10/5 기준)
export function calcMockExamHistoryGrade(score: number): number {
  if (score >= 40) return 1;
  if (score >= 35) return 2;
  if (score >= 30) return 3;
  if (score >= 25) return 4;
  if (score >= 20) return 5;
  if (score >= 15) return 6;
  if (score >= 10) return 7;
  if (score >= 5) return 8;
  return 9;
}

// 모의고사 과목 분류
export const MOCK_RELATIVE_SUBJECTS = ["국어", "수학", "탐구1", "탐구2"];
export const MOCK_HISTORY_SUBJECTS = ["한국사", "제2외국어"];

// 내신 분류 과목: 세부 과목명 입력이 필요한 카테고리
export const GRADE_CATEGORY_SUBJECTS_HIGH = ["국어", "수학", "영어", "사회탐구", "과학탐구", "제2외국어"];

export function isGradeCategorySubject(
  category: string,
  schoolLevel: "middle" | "high" | null | undefined,
): boolean {
  if (schoolLevel === "high") return GRADE_CATEGORY_SUBJECTS_HIGH.includes(category);
  return false;
}

/** 카테고리 + 세부 과목명 → 저장할 과목 문자열
 * - 기타 + "미용" → "미용"
 * - 사회탐구 + "한국지리" → "사회탐구(한국지리)"
 * - 국어 + "" → "국어"
 */
export function buildGradeSubjectName(
  category: string,
  detail: string,
  schoolLevel: "middle" | "high" | null | undefined,
): string {
  const trimmed = detail.trim();
  if (category === "기타") return trimmed || "기타";
  if (isGradeCategorySubject(category, schoolLevel) && trimmed) {
    return `${category}(${trimmed})`;
  }
  return category;
}

/** 저장된 과목명 파싱
 * - "사회탐구(한국지리)" → { category: "사회탐구", detail: "한국지리" }
 * - "국어" → { category: "국어", detail: "" }
 * - "미용" (preset에 없는 경우) → { category: "기타", detail: "미용" }
 */
export function parseGradeSubjectName(
  subjectName: string,
  schoolLevel: "middle" | "high" | null | undefined,
  presetSubjects: string[],
): { category: string; detail: string } {
  if (schoolLevel === "high") {
    for (const cat of GRADE_CATEGORY_SUBJECTS_HIGH) {
      if (subjectName === cat) return { category: cat, detail: "" };
      if (subjectName.startsWith(`${cat}(`)) {
        return { category: cat, detail: subjectName.slice(cat.length + 1, -1) };
      }
    }
  }
  if (presetSubjects.includes(subjectName)) {
    return { category: subjectName, detail: "" };
  }
  return { category: "기타", detail: subjectName === "기타" ? "" : subjectName };
}

// 분류 과목별 세부 입력 플레이스홀더
export const GRADE_CATEGORY_DETAIL_PLACEHOLDER: Record<string, string> = {
  국어: "예: 문학, 독서, 언어와매체, 화법과작문...",
  수학: "예: 수학I, 수학II, 미적분, 확률과통계...",
  영어: "예: 영어I, 영어II, 영어독해와작문...",
  사회탐구: "예: 한국지리, 생활과윤리, 경제...",
  과학탐구: "예: 물리학I, 화학I, 생명과학I...",
  제2외국어: "예: 일본어I, 중국어I, 프랑스어I...",
  기타: "과목명을 직접 입력하세요",
};
