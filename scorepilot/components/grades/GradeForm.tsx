"use client";

import { useActionState, useState, useEffect, startTransition } from "react";
import { addGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  commonSubjects,
  sortSubjectsByPreferredOrder,
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

const INITIAL = {
  subjectMode: "select" as "select" | "custom",
  selectedSubject: "",
  customSubject: "",
  examType: "midterm",
  score: "",
  maxScore: "100",
  memo: "",
};

export default function GradeForm({ subjects }: { subjects: string[] }) {
  const [state, action, pending] = useActionState(addGrade, null);
  const [open, setOpen] = useState(false);
  const [subjectMode, setSubjectMode] = useState(INITIAL.subjectMode);
  const [selectedSubject, setSelectedSubject] = useState(INITIAL.selectedSubject);
  const [customSubject, setCustomSubject] = useState(INITIAL.customSubject);
  const [examType, setExamType] = useState(INITIAL.examType);
  const [score, setScore] = useState(INITIAL.score);
  const [maxScore, setMaxScore] = useState(INITIAL.maxScore);
  const [semesterYear, setSemesterYear] = useState(() => new Date().getFullYear());
  const [semesterType, setSemesterType] = useState<SemesterType>(defaultSemesterType);
  const [memo, setMemo] = useState(INITIAL.memo);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setSubjectMode(INITIAL.subjectMode);
      setSelectedSubject(INITIAL.selectedSubject);
      setCustomSubject(INITIAL.customSubject);
      setExamType(INITIAL.examType);
      setScore(INITIAL.score);
      setMaxScore(INITIAL.maxScore);
      setSemesterYear(new Date().getFullYear());
      setSemesterType(defaultSemesterType());
      setMemo(INITIAL.memo);
    }
  }, [state]);

  const subjectOptions = sortSubjectsByPreferredOrder(commonSubjects);
  const subjectName = subjectMode === "select" ? selectedSubject : customSubject;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger render={<Button>+ 성적 추가</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }} className="space-y-4 mt-2">
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label>과목명<span className="text-red-500">*</span></Label>
            <select
              value={subjectMode === "custom" ? "__custom__" : selectedSubject}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setSubjectMode("custom");
                  setSelectedSubject("");
                } else {
                  setSubjectMode("select");
                  setSelectedSubject(e.target.value);
                }
              }}
              className={selectClass}
            >
              <option value="">과목 선택</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__custom__">기타(직접 입력)</option>
            </select>
            {subjectMode === "custom" && (
              <Input
                placeholder="과목명 입력"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                autoFocus
              />
            )}
          </div>
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
                {(Object.entries(semesterTypeLabels) as [SemesterType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
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
