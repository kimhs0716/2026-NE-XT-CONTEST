"use client";

import { useActionState, useState, useEffect } from "react";
import { addGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  commonSubjects,
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

const todayStr = () => new Date().toLocaleDateString("en-CA");

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
  const [examDate, setExamDate] = useState(() => todayStr());
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
      setExamDate(todayStr());
      setMemo(INITIAL.memo);
    }
  }, [state]);

  const subjectOptions = [...new Set([...commonSubjects, ...subjects])];
  const subjectName = subjectMode === "select" ? selectedSubject : customSubject;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger render={<Button>+ 성적 추가</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 추가</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
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
            <Label htmlFor="exam_type">시험 종류</Label>
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
              <Label htmlFor="score">점수</Label>
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
            <Label htmlFor="exam_date">날짜</Label>
            <Input
              id="exam_date"
              name="exam_date"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              required
            />
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
