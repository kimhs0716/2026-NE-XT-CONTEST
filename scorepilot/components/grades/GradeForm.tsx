"use client";

import { useActionState, useState, useEffect, startTransition } from "react";
import { addGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  subjectCategories,
  semesterTypeLabels,
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

function defaultSemesterType(): SemesterType {
  const m = new Date().getMonth() + 1;
  return m >= 3 && m <= 8 ? "semester_1" : "semester_2";
}

export default function GradeForm({ showCategory = false }: { showCategory?: boolean }) {
  const [state, action, pending] = useActionState(addGrade, null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [examType, setExamType] = useState("midterm");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [semesterYear, setSemesterYear] = useState(() => new Date().getFullYear());
  const [semesterType, setSemesterType] = useState<SemesterType>(defaultSemesterType);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setCategory("");
      setSubjectName("");
      setExamType("midterm");
      setScore("");
      setMaxScore("100");
      setSemesterYear(new Date().getFullYear());
      setSemesterType(defaultSemesterType());
      setMemo("");
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger render={<Button>+ 성적 추가</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 추가</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
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
                  placeholder="화법과작문, 수학I…"
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
                placeholder="국어, 수학, 영어…"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="exam_type">시험 종류<span className="text-red-500">*</span></Label>
            <select
              id="exam_type"
              name="exam_type"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
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
              <Label htmlFor="score">점수<span className="text-red-500">*</span></Label>
              <Input
                id="score"
                name="score"
                type="number"
                min="0"
                step="0.01"
                placeholder="85"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_score">만점</Label>
              <Input
                id="max_score"
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
            <Label htmlFor="memo">메모 (선택)</Label>
            <Input
              id="memo"
              name="memo"
              placeholder="범위: 1~3단원"
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
