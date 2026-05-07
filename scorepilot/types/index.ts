export type SchoolLevel = "middle" | "high";

export type ExamType = "midterm" | "final" | "assignment" | "mock_exam" | "other";

export type EventType = "exam" | "assignment" | "mock_exam" | "study" | "school_academy" | "other";

export type TaskType = "homework" | "review" | "preview" | "problem_solving" | "memorization" | "other";

export type Priority = "low" | "medium" | "high";

export type Difficulty = "easy" | "normal" | "hard";

export type Trend = "up" | "down" | "stable" | "unknown";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  school_level: SchoolLevel | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectGoal {
  id: string;
  user_id: string;
  subject_id: string;
  target_score: number;
  target_date: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  exam_type: ExamType;
  exam_date: string;
  max_score: number;
  weight: number | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface GradeRecord {
  id: string;
  user_id: string;
  subject_id: string;
  exam_id: string | null;
  score: number;
  max_score: number;
  percentage: number;
  grade_level: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  subject_id: string | null;
  exam_id: string | null;
  title: string;
  event_type: EventType;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudyTask {
  id: string;
  user_id: string;
  subject_id: string | null;
  schedule_id: string | null;
  title: string;
  task_type: TaskType | null;
  due_date: string | null;
  priority: Priority | null;
  is_completed: boolean;
  completed_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyLog {
  id: string;
  user_id: string;
  subject_id: string | null;
  study_date: string;
  duration_minutes: number | null;
  content: string | null;
  difficulty: Difficulty | null;
  concentration_level: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScorePrediction {
  id: string;
  user_id: string;
  subject_id: string;
  predicted_score: number | null;
  prediction_target: string | null;
  model_type: string | null;
  confidence: number | null;
  basis: string | null;
  created_at: string;
}
