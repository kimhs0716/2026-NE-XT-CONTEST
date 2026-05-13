"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { examTypeLabels, formatSemester, type ExamType, type SemesterType } from "@/lib/constants/grades";

async function findOrCreateSemester(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  semesterYear: number,
  semesterType: SemesterType,
) {
  const { data: existingSem } = await supabase
    .from("semesters")
    .select("id")
    .eq("user_id", userId)
    .eq("year", semesterYear)
    .eq("semester_type", semesterType)
    .single();

  if (existingSem) return { semesterId: existingSem.id };

  const { data: newSem, error } = await supabase
    .from("semesters")
    .insert({
      user_id: userId,
      year: semesterYear,
      semester_type: semesterType,
      name: formatSemester(semesterYear, semesterType),
    })
    .select("id")
    .single();

  if (error) return { error: "학기 정보 저장 중 오류가 발생했습니다." };
  return { semesterId: newSem.id };
}

async function findOrCreateSubject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  semesterId: string,
  subjectName: string,
  category?: string | null,
) {
  const { data: existingSub } = await supabase
    .from("subjects")
    .select("id, category")
    .eq("user_id", userId)
    .eq("semester_id", semesterId)
    .eq("name", subjectName)
    .single();

  if (existingSub) {
    const cleanCategory = category?.trim() || null;
    if (cleanCategory && existingSub.category !== cleanCategory) {
      await supabase
        .from("subjects")
        .update({ category: cleanCategory })
        .eq("id", existingSub.id)
        .eq("user_id", userId);
    }
    return { subjectId: existingSub.id };
  }

  const { data: newSub, error } = await supabase
    .from("subjects")
    .insert({
      user_id: userId,
      semester_id: semesterId,
      name: subjectName,
      category: category?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { error: "과목 생성 중 오류가 발생했습니다." };
  return { subjectId: newSub.id };
}

export async function addSemester(_: unknown, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다." };

    const semesterYear = parseInt(formData.get("semester_year") as string, 10);
    const semesterType = formData.get("semester_type") as SemesterType;

    if (!semesterYear || !semesterType) return { error: "학기를 선택해주세요." };

    const { error } = await findOrCreateSemester(supabase, user.id, semesterYear, semesterType);
    if (error) return { error };

    revalidatePath("/grades");
    return { success: true };
  } catch (e) {
    console.error("[addSemester]", e);
    return { error: "학기 추가 중 오류가 발생했습니다." };
  }
}

export async function addSubject(_: unknown, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다." };

    const subjectName = (formData.get("subject_name") as string | null)?.trim() ?? "";
    const subjectCategory = (formData.get("subject_category") as string | null)?.trim() ?? "";
    const semesterYear = parseInt(formData.get("semester_year") as string, 10);
    const semesterType = formData.get("semester_type") as SemesterType;

    if (!subjectName) return { error: "과목명을 입력해주세요." };
    if (!subjectCategory) return { error: "과목 분류를 선택해주세요." };
    if (!semesterYear || !semesterType) return { error: "학기를 선택해주세요." };

    const semester = await findOrCreateSemester(supabase, user.id, semesterYear, semesterType);
    if (semester.error || !semester.semesterId) return { error: semester.error ?? "학기 정보 저장 중 오류가 발생했습니다." };

    const subject = await findOrCreateSubject(supabase, user.id, semester.semesterId, subjectName, subjectCategory);
    if (subject.error) return { error: subject.error };

    revalidatePath("/grades");
    return { success: true };
  } catch (e) {
    console.error("[addSubject]", e);
    return { error: "과목 추가 중 오류가 발생했습니다." };
  }
}

export async function addGrade(_: unknown, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다." };

    const subjectName = (formData.get("subject_name") as string | null)?.trim() ?? "";
    const subjectCategory = (formData.get("subject_category") as string | null)?.trim() ?? "";
    const examType = formData.get("exam_type") as ExamType;
    const semesterYear = parseInt(formData.get("semester_year") as string, 10);
    const semesterType = formData.get("semester_type") as SemesterType;
    const score = parseFloat(formData.get("score") as string);
    const maxScore = parseFloat(formData.get("max_score") as string) || 100;
    const gradeLevel = (formData.get("grade_level") as string | null)?.trim() || null;
    const weightValue = (formData.get("weight") as string | null)?.trim() ?? "";
    const weight = weightValue ? parseFloat(weightValue) : null;
    const memo = (formData.get("memo") as string) || null;

    if (!subjectName) return { error: "과목명을 입력해주세요." };
    if (!semesterYear || !semesterType) return { error: "학기를 선택해주세요." };
    if (isNaN(score) || score < 0) return { error: "올바른 점수를 입력해주세요." };
    if (score > maxScore) return { error: "점수가 만점보다 클 수 없습니다." };
    if (weight != null && (isNaN(weight) || weight < 0 || weight > 100)) {
      return { error: "반영비는 0~100 사이로 입력해주세요." };
    }

    const semester = await findOrCreateSemester(supabase, user.id, semesterYear, semesterType);
    if (semester.error || !semester.semesterId) return { error: semester.error ?? "학기 정보 저장 중 오류가 발생했습니다." };
    const semesterId = semester.semesterId;

    const subject = await findOrCreateSubject(supabase, user.id, semesterId, subjectName, subjectCategory);
    if (subject.error || !subject.subjectId) return { error: subject.error ?? "과목 생성 중 오류가 발생했습니다." };
    const subjectId = subject.subjectId;

    // 중복 확인
    const { data: duplicate } = await supabase
      .from("exams")
      .select("id")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .eq("exam_semester", semesterId)
      .eq("exam_type", examType)
      .single();
    if (duplicate) return { error: "같은 학기에 같은 과목·시험 종류가 이미 존재합니다." };

    // 시험 생성
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .insert({
        user_id: user.id,
        subject_id: subjectId,
        exam_semester: semesterId,
        title: `${subjectName} ${examTypeLabels[examType]}`,
        exam_type: examType,
        max_score: maxScore,
        weight,
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
      grade_level: gradeLevel,
      memo,
    });
    if (gradeError) return { error: `성적 저장 중 오류가 발생했습니다: ${gradeError.message}` };

    revalidatePath("/grades");
    return { success: true };
  } catch (e) {
    console.error("[addGrade]", e);
    return { error: "알 수 없는 오류가 발생했습니다." };
  }
}

export async function updateGrade(_: unknown, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다." };

    const examId = formData.get("exam_id") as string;
    const subjectName = (formData.get("subject_name") as string | null)?.trim() ?? "";
    const subjectCategory = (formData.get("subject_category") as string | null)?.trim() ?? "";
    const examType = formData.get("exam_type") as ExamType;
    const semesterYear = parseInt(formData.get("semester_year") as string, 10);
    const semesterType = formData.get("semester_type") as SemesterType;
    const score = parseFloat(formData.get("score") as string);
    const maxScore = parseFloat(formData.get("max_score") as string) || 100;
    const gradeLevel = (formData.get("grade_level") as string | null)?.trim() || null;
    const weightValue = (formData.get("weight") as string | null)?.trim() ?? "";
    const weight = weightValue ? parseFloat(weightValue) : null;
    const memo = (formData.get("memo") as string) || null;

    if (!subjectName) return { error: "과목명을 입력해주세요." };
    if (!semesterYear || !semesterType) return { error: "학기를 선택해주세요." };
    if (isNaN(score) || score < 0) return { error: "올바른 점수를 입력해주세요." };
    if (score > maxScore) return { error: "점수가 만점보다 클 수 없습니다." };
    if (weight != null && (isNaN(weight) || weight < 0 || weight > 100)) {
      return { error: "반영비는 0~100 사이로 입력해주세요." };
    }

    const semester = await findOrCreateSemester(supabase, user.id, semesterYear, semesterType);
    if (semester.error || !semester.semesterId) return { error: semester.error ?? "학기 정보 저장 중 오류가 발생했습니다." };
    const semesterId = semester.semesterId;

    const subject = await findOrCreateSubject(supabase, user.id, semesterId, subjectName, subjectCategory);
    if (subject.error || !subject.subjectId) return { error: subject.error };
    const subjectId = subject.subjectId;

    const { error: examError } = await supabase
      .from("exams")
      .update({
        subject_id: subjectId,
        exam_semester: semesterId,
        title: `${subjectName} ${examTypeLabels[examType]}`,
        exam_type: examType,
        max_score: maxScore,
        weight,
      })
      .eq("id", examId)
      .eq("user_id", user.id);
    if (examError) return { error: "시험 정보 수정 중 오류가 발생했습니다." };

    const { error: gradeError } = await supabase
      .from("grade_records")
      .update({ score, max_score: maxScore, grade_level: gradeLevel, memo })
      .eq("exam_id", examId)
      .eq("user_id", user.id);
    if (gradeError) return { error: `성적 수정 중 오류가 발생했습니다: ${gradeError.message}` };

    revalidatePath("/grades");
    return { success: true };
  } catch (e) {
    console.error("[updateGrade]", e);
    return { error: "알 수 없는 오류가 발생했습니다." };
  }
}

export async function deleteGrade(examId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("user_id", user.id);

  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidatePath("/grades");
  return { success: true };
}
