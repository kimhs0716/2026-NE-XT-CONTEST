"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { examTypeLabels, type ExamType } from "@/lib/constants/grades";

export async function addGrade(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const subjectName = (formData.get("subject_name") as string).trim();
  const examType = formData.get("exam_type") as ExamType;
  const examDate = formData.get("exam_date") as string;
  const score = parseFloat(formData.get("score") as string);
  const maxScore = parseFloat(formData.get("max_score") as string) || 100;
  const memo = (formData.get("memo") as string) || null;

  if (!subjectName) return { error: "과목명을 입력해주세요." };
  if (!examDate) return { error: "날짜를 입력해주세요." };
  if (isNaN(score) || score < 0) return { error: "올바른 점수를 입력해주세요." };
  if (score > maxScore) return { error: "점수가 만점보다 클 수 없습니다." };

  // 과목 찾기 또는 생성
  let subjectId: string;
  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", subjectName)
    .single();

  if (existing) {
    subjectId = existing.id;
  } else {
    const { data: newSubject, error: subjectError } = await supabase
      .from("subjects")
      .insert({ user_id: user.id, name: subjectName })
      .select("id")
      .single();
    if (subjectError) return { error: "과목 생성 중 오류가 발생했습니다." };
    subjectId = newSubject.id;
  }

  // 중복 확인
  const { data: duplicate } = await supabase
    .from("exams")
    .select("id")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .eq("exam_date", examDate)
    .eq("exam_type", examType)
    .single();
  if (duplicate) return { error: "동일한 날짜에 같은 과목·시험 종류가 이미 존재합니다." };

  // 시험 생성
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      title: `${subjectName} ${examTypeLabels[examType]}`,
      exam_type: examType,
      exam_date: examDate,
      max_score: maxScore,
    })
    .select("id")
    .single();
  if (examError) return { error: "시험 정보 저장 중 오류가 발생했습니다." };

  // 성적 기록 생성
  const { error: gradeError } = await supabase.from("grade_records").insert({
    user_id: user.id,
    subject_id: subjectId,
    exam_id: exam.id,
    score,
    max_score: maxScore,
    memo,
  });
  if (gradeError) return { error: "성적 저장 중 오류가 발생했습니다." };

  revalidatePath("/grades");
  return { success: true };
}

export async function updateGrade(_: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const examId = formData.get("exam_id") as string;
  const subjectName = (formData.get("subject_name") as string).trim();
  const examType = formData.get("exam_type") as ExamType;
  const examDate = formData.get("exam_date") as string;
  const score = parseFloat(formData.get("score") as string);
  const maxScore = parseFloat(formData.get("max_score") as string) || 100;
  const memo = (formData.get("memo") as string) || null;

  if (!subjectName) return { error: "과목명을 입력해주세요." };
  if (!examDate) return { error: "날짜를 입력해주세요." };
  if (isNaN(score) || score < 0) return { error: "올바른 점수를 입력해주세요." };
  if (score > maxScore) return { error: "점수가 만점보다 클 수 없습니다." };

  let subjectId: string;
  const { data: existing } = await supabase
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", subjectName)
    .single();

  if (existing) {
    subjectId = existing.id;
  } else {
    const { data: newSubject, error: subjectError } = await supabase
      .from("subjects")
      .insert({ user_id: user.id, name: subjectName })
      .select("id")
      .single();
    if (subjectError) return { error: "과목 생성 중 오류가 발생했습니다." };
    subjectId = newSubject.id;
  }

  const { error: examError } = await supabase
    .from("exams")
    .update({
      subject_id: subjectId,
      title: `${subjectName} ${examTypeLabels[examType]}`,
      exam_type: examType,
      exam_date: examDate,
      max_score: maxScore,
    })
    .eq("id", examId)
    .eq("user_id", user.id);
  if (examError) return { error: "시험 정보 수정 중 오류가 발생했습니다." };

  const { error: gradeError } = await supabase
    .from("grade_records")
    .update({ score, max_score: maxScore, memo })
    .eq("exam_id", examId)
    .eq("user_id", user.id);
  if (gradeError) return { error: "성적 수정 중 오류가 발생했습니다." };

  revalidatePath("/grades");
  return { success: true };
}

export async function deleteGrade(examId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // exam 삭제 시 grade_records는 ON DELETE SET NULL
  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("user_id", user.id);

  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidatePath("/grades");
  return { success: true };
}
