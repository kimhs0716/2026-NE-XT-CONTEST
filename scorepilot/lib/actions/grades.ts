"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { examTypeLabels, formatSemester, type ExamType, type SemesterType } from "@/lib/constants/grades";
import { encodeSubjectSegment } from "@/lib/subject-route";

function revalidateGradeViews(subjectName?: string) {
  revalidatePath("/grades");
  revalidatePath("/grades/[subject]", "page");
  revalidatePath("/analytics");
  revalidatePath("/analytics/[subject]", "page");
  revalidatePath("/strategy");
  revalidatePath("/dashboard");
  if (subjectName) {
    const encoded = encodeSubjectSegment(subjectName);
    revalidatePath(`/grades/${encoded}`);
    revalidatePath(`/analytics/${encoded}`);
  }
}

export async function addGrade(_: unknown, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "로그인이 필요합니다." };

    const subjectName = (formData.get("subject_name") as string | null)?.trim() ?? "";
    const examType = formData.get("exam_type") as ExamType;
    const semesterYear = parseInt(formData.get("semester_year") as string, 10);
    const semesterType = formData.get("semester_type") as SemesterType;
    const score = parseFloat(formData.get("score") as string);
    const maxScore = parseFloat(formData.get("max_score") as string) || 100;
    const memo = (formData.get("memo") as string) || null;

    if (!subjectName) return { error: "과목명을 입력해주세요." };
    if (!semesterYear || !semesterType) return { error: "학기를 선택해주세요." };
    if (isNaN(score) || score < 0) return { error: "올바른 점수를 입력해주세요." };
    if (score > maxScore) return { error: "점수가 만점보다 클 수 없습니다." };

    // 학기 찾기 또는 생성
    const { data: existingSem } = await supabase
      .from("semesters")
      .select("id")
      .eq("user_id", user.id)
      .eq("year", semesterYear)
      .eq("semester_type", semesterType)
      .single();

    let semesterId: string;
    if (existingSem) {
      semesterId = existingSem.id;
    } else {
      const { data: newSem, error: semError } = await supabase
        .from("semesters")
        .insert({ user_id: user.id, year: semesterYear, semester_type: semesterType, name: formatSemester(semesterYear, semesterType) })
        .select("id")
        .single();
      if (semError) { console.error("[addGrade] semError", semError); return { error: "학기 정보 저장 중 오류가 발생했습니다." }; }
      semesterId = newSem.id;
    }

    // 과목 찾기 또는 생성
    const { data: existingSub } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", user.id)
      .eq("semester_id", semesterId)
      .eq("name", subjectName)
      .single();

    let subjectId: string;
    if (existingSub) {
      subjectId = existingSub.id;
    } else {
      const { data: newSub, error: subError } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, semester_id: semesterId, name: subjectName })
        .select("id")
        .single();
      if (subError) return { error: "과목 생성 중 오류가 발생했습니다." };
      subjectId = newSub.id;
    }

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
    if (gradeError) return { error: `성적 저장 중 오류가 발생했습니다: ${gradeError.message}` };

    revalidateGradeViews(subjectName);
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
    const examType = formData.get("exam_type") as ExamType;
    const semesterYear = parseInt(formData.get("semester_year") as string, 10);
    const semesterType = formData.get("semester_type") as SemesterType;
    const score = parseFloat(formData.get("score") as string);
    const maxScore = parseFloat(formData.get("max_score") as string) || 100;
    const memo = (formData.get("memo") as string) || null;

    if (!subjectName) return { error: "과목명을 입력해주세요." };
    if (!semesterYear || !semesterType) return { error: "학기를 선택해주세요." };
    if (isNaN(score) || score < 0) return { error: "올바른 점수를 입력해주세요." };
    if (score > maxScore) return { error: "점수가 만점보다 클 수 없습니다." };

    const { data: existingSem } = await supabase
      .from("semesters")
      .select("id")
      .eq("user_id", user.id)
      .eq("year", semesterYear)
      .eq("semester_type", semesterType)
      .single();

    let semesterId: string;
    if (existingSem) {
      semesterId = existingSem.id;
    } else {
      const { data: newSem, error: semError } = await supabase
        .from("semesters")
        .insert({ user_id: user.id, year: semesterYear, semester_type: semesterType, name: formatSemester(semesterYear, semesterType) })
        .select("id")
        .single();
      if (semError) { console.error("[updateGrade] semError", semError); return { error: "학기 정보 저장 중 오류가 발생했습니다." }; }
      semesterId = newSem.id;
    }

    const { data: existingSub } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", user.id)
      .eq("semester_id", semesterId)
      .eq("name", subjectName)
      .single();

    let subjectId: string;
    if (existingSub) {
      subjectId = existingSub.id;
    } else {
      const { data: newSub, error: subError } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, semester_id: semesterId, name: subjectName })
        .select("id")
        .single();
      if (subError) return { error: `과목 생성 오류: ${subError.message}` };
      subjectId = newSub.id;
    }

    const { error: examError } = await supabase
      .from("exams")
      .update({
        subject_id: subjectId,
        exam_semester: semesterId,
        title: `${subjectName} ${examTypeLabels[examType]}`,
        exam_type: examType,
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
    if (gradeError) return { error: `성적 수정 중 오류가 발생했습니다: ${gradeError.message}` };

    revalidateGradeViews(subjectName);
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

  const { data: exam } = await supabase
    .from("exams")
    .select("subjects ( name )")
    .eq("id", examId)
    .eq("user_id", user.id)
    .single();
  const subjects = exam?.subjects as { name: string } | { name: string }[] | null | undefined;
  const subject = Array.isArray(subjects) ? subjects[0]?.name : subjects?.name;

  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("user_id", user.id);

  if (error) return { error: "삭제 중 오류가 발생했습니다." };

  revalidateGradeViews(subject);
  return { success: true };
}
