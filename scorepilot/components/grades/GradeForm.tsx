"use client";

import { useActionState, useState, useEffect } from "react";
import { addGrade } from "@/lib/actions/grades";
import { examTypeLabels, type ExamType } from "@/lib/constants/grades";
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

export default function GradeForm() {
  const [state, action, pending] = useActionState(addGrade, null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger render={<Button>+ 성적 추가</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 추가</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="subject_name">과목명</Label>
            <Input
              id="subject_name"
              name="subject_name"
              placeholder="수학"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam_type">시험 종류</Label>
            <select
              id="exam_type"
              name="exam_type"
              required
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {(Object.entries(examTypeLabels) as [ExamType, string][]).map(
                ([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                )
              )}
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
                defaultValue="100"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam_date">날짜</Label>
            <Input
              id="exam_date"
              name="exam_date"
              type="date"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">메모 (선택)</Label>
            <Input
              id="memo"
              name="memo"
              placeholder="범위: 1~3단원"
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
