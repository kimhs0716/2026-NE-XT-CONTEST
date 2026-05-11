"use client";

import { useActionState, useEffect, useState } from "react";
import { updateGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  commonSubjects,
  type ExamType,
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
  date: string;
  memo: string | null;
};

export default function GradeEditForm({ grade, subjects }: { grade: Grade; subjects: string[] }) {
  const [state, action, pending] = useActionState(updateGrade, null);
  const [open, setOpen] = useState(false);

  const subjectOptions = [...new Set([...commonSubjects, ...subjects])];
  const isKnown = subjectOptions.includes(grade.subject);

  const [subjectMode, setSubjectMode] = useState<"select" | "custom">(
    isKnown ? "select" : "custom"
  );
  const [selectedSubject, setSelectedSubject] = useState(isKnown ? grade.subject : "");
  const [customSubject, setCustomSubject] = useState(isKnown ? "" : grade.subject);
  const [examType, setExamType] = useState(grade.examType);
  const [score, setScore] = useState(String(grade.score));
  const [maxScore, setMaxScore] = useState(String(grade.maxScore));
  const [examDate, setExamDate] = useState(grade.date);
  const [memo, setMemo] = useState(grade.memo ?? "");

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  const subjectName = subjectMode === "select" ? selectedSubject : customSubject;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">수정</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 수정</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <input type="hidden" name="exam_id" value={grade.examId} />
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label>과목명</Label>
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
              <option value="__custom__">직접 입력...</option>
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
            <Label htmlFor="edit_exam_type">시험 종류</Label>
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
              <Label htmlFor="edit_score">점수</Label>
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
            <Label htmlFor="edit_exam_date">날짜</Label>
            <Input
              id="edit_exam_date"
              name="exam_date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              required
            />
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
