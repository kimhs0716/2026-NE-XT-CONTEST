"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { upsertSubjectGoal } from "@/lib/actions/goals";
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

type Goal = {
  targetScore: number;
  targetDate: string | null;
  memo: string | null;
} | null;

export default function SubjectGoalForm({
  subjectId,
  subjectName,
  goal,
}: {
  subjectId: string;
  subjectName: string;
  goal: Goal;
}) {
  const [state, action, pending] = useActionState(upsertSubjectGoal, null);
  const [open, setOpen] = useState(false);
  const [targetScore, setTargetScore] = useState(goal ? String(goal.targetScore) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [memo, setMemo] = useState(goal?.memo ?? "");

  useEffect(() => {
    if (state?.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={goal ? "ghost" : "outline"} size="sm">
            {goal ? "목표 수정" : "목표 설정"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subjectName} 목표 점수</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          <input type="hidden" name="subject_id" value={subjectId} />
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label htmlFor="target-score">목표 점수</Label>
            <Input
              id="target-score"
              name="target_score"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
              placeholder="예: 90"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-date">목표 날짜</Label>
            <Input
              id="target-date"
              name="target_date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-memo">메모</Label>
            <Input
              id="goal-memo"
              name="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 기말고사 전까지 유지"
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
