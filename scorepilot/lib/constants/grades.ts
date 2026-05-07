export type ExamType = "midterm" | "final" | "assignment" | "mock_exam" | "other";

export const examTypeLabels: Record<ExamType, string> = {
  midterm: "중간고사",
  final: "기말고사",
  assignment: "수행평가",
  mock_exam: "모의고사",
  other: "기타",
};
