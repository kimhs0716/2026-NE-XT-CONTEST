"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { updateGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  getSubjectsBySchoolLevel,
  semesterTypeLabels,
  isGradeCategorySubject,
  buildGradeSubjectName,
  parseGradeSubjectName,
  GRADE_CATEGORY_DETAIL_PLACEHOLDER,
  type ExamType,
  type SemesterType,
} from "@/lib/constants/grades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const WEIGHTED_EXAM_TYPES: ExamType[] = ["midterm", "assignment", "final"];

type Grade = {
  examId: string;
  subject: string;
  examType: ExamType;
  score: number;
  maxScore: number;
  weight?: number | null;
  gradeLevel?: string | null;
  semesterYear: number;
  semesterType: SemesterType;
  memo: string | null;
};

export default function GradeEditForm({
  grade,
  subjects,
  schoolLevel,
}: {
  grade: Grade;
  subjects: string[];
  schoolLevel?: "middle" | "high" | null;
}) {
  const [state, action, pending] = useActionState(updateGrade, null);
  const [open, setOpen] = useState(false);

  const presetSubjects = getSubjectsBySchoolLevel(schoolLevel);
  const parsed = parseGradeSubjectName(grade.subject, schoolLevel, [...new Set([...presetSubjects, ...subjects])]);

  const [selectedCategory, setSelectedCategory] = useState(parsed.category);
  const [categoryDetail, setCategoryDetail] = useState(parsed.detail);
  const [examType, setExamType] = useState(grade.examType);
  const [score, setScore] = useState(String(grade.score));
  const [maxScore, setMaxScore] = useState(String(grade.maxScore));
  const [weight, setWeight] = useState(grade.weight != null ? String(grade.weight) : "");
  const [semesterYear, setSemesterYear] = useState(grade.semesterYear);
  const [semesterType, setSemesterType] = useState<SemesterType>(grade.semesterType);
  const [memo, setMemo] = useState(grade.memo ?? "");

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  const showDetailInput =
    isGradeCategorySubject(selectedCategory, schoolLevel) || selectedCategory === "기타";
  const subjectName = buildGradeSubjectName(selectedCategory, categoryDetail, schoolLevel);
  const showWeight = WEIGHTED_EXAM_TYPES.includes(examType);
  const detailPlaceholder =
    GRADE_CATEGORY_DETAIL_PLACEHOLDER[selectedCategory] ?? "세부 과목명 입력";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">수정</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 수정</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          <input type="hidden" name="exam_id" value={grade.examId} />
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label>과목명<span className="text-red-500">*</span></Label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCategoryDetail("");
              }}
              className={selectClass}
            >
              <option value="">과목 선택</option>
              {presetSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="기타">기타</option>
            </select>
            {showDetailInput && (
              <Input
                placeholder={detailPlaceholder}
                value={categoryDetail}
                onChange={(e) => setCategoryDetail(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_exam_type">시험 종류<span className="text-red-500">*</span></Label>
            <select
              id="edit_exam_type"
              name="exam_type"
              value={examType}
              onChange={(e) => setExamType(e.target.value as ExamType)}
              className={selectClass}
            >
              {examTypeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map((type) => (
                    <option key={type} value={type}>
                      {examTypeLabels[type]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit_score">점수<span className="text-red-500">*</span></Label>
              <Input
                id="edit_score"
                name="score"
                type="number"
                min="0"
                step="0.01"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_max_score">만점</Label>
              <Input
                id="edit_max_score"
                name="max_score"
                type="number"
                min="1"
                step="0.01"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </div>
          </div>
          {showWeight && (
            <div className="space-y-2">
              <Label htmlFor="edit_weight">반영비 (%)</Label>
              <Input
                id="edit_weight"
                name="weight"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="30"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>학기<span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="semester_year"
                type="number"
                min="2000"
                max="2099"
                value={semesterYear}
                onChange={(e) => setSemesterYear(parseInt(e.target.value, 10))}
                required
              />
              <select
                name="semester_type"
                value={semesterType}
                onChange={(e) => setSemesterType(e.target.value as SemesterType)}
                className={selectClass}
              >
                {(Object.entries(semesterTypeLabels) as [SemesterType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_memo">메모 (선택)</Label>
            <Input
              id="edit_memo"
              name="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
