"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { updateGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  subjectCategories,
  semesterTypeLabels,
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

type Grade = {
  examId: string;
  subject: string;
  examType: ExamType;
  score: number;
  maxScore: number;
  semesterYear: number;
  semesterType: SemesterType;
  memo: string | null;
};

export default function GradeEditForm({
  grade,
  initialCategory,
  showCategory = false,
}: {
  grade: Grade;
  initialCategory?: string | null;
  showCategory?: boolean;
}) {
  const [state, action, pending] = useActionState(updateGrade, null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(initialCategory ?? "");
  const [subjectName, setSubjectName] = useState(grade.subject);
  const [examType, setExamType] = useState(grade.examType);
  const [score, setScore] = useState(String(grade.score));
  const [maxScore, setMaxScore] = useState(String(grade.maxScore));
  const [semesterYear, setSemesterYear] = useState(grade.semesterYear);
  const [semesterType, setSemesterType] = useState<SemesterType>(grade.semesterType);
  const [memo, setMemo] = useState(grade.memo ?? "");

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

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
          <input type="hidden" name="category" value={category} />

          {showCategory ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>카테고리</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={selectClass}
                >
                  <option value="">선택 안 함</option>
                  {subjectCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>과목명<span className="text-red-500">*</span></Label>
                <Input
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>과목명<span className="text-red-500">*</span></Label>
              <Input
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
            </div>
          )}

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
                    <option key={type} value={type}>{examTypeLabels[type]}</option>
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
                {(Object.entries(semesterTypeLabels) as [SemesterType, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  )
                )}
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

          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
