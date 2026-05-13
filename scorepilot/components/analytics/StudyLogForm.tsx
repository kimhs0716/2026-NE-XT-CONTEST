"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { addStudyLog, updateStudyLog } from "@/lib/actions/study";
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

type SubjectOption = {
  id: string;
  name: string;
};

export type StudyLogFormValue = {
  id: string;
  subjectId: string | null;
  studyDate: string;
  durationMinutes: number | null;
  difficulty: string | null;
  concentrationLevel: number | null;
  content: string | null;
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudyLogForm({
  subjects,
  defaultSubjectName,
  log,
  triggerLabel,
}: {
  subjects: SubjectOption[];
  defaultSubjectName?: string;
  log?: StudyLogFormValue;
  triggerLabel?: string;
}) {
  const [state, action, pending] = useActionState(log ? updateStudyLog : addStudyLog, null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultSubjectId =
    subjects.find((subject) => subject.name === defaultSubjectName)?.id ?? subjects[0]?.id ?? "";
  const [subjectId, setSubjectId] = useState(log?.subjectId ?? defaultSubjectId);
  const [studyDate, setStudyDate] = useState(log?.studyDate ?? todayString);
  const [duration, setDuration] = useState(log?.durationMinutes != null ? String(log.durationMinutes) : "");
  const [difficulty, setDifficulty] = useState(log?.difficulty ?? "normal");
  const [concentration, setConcentration] = useState(log?.concentrationLevel != null ? String(log.concentrationLevel) : "3");
  const [content, setContent] = useState(log?.content ?? "");

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      if (!log) {
        setSubjectId(defaultSubjectId);
        setStudyDate(todayString());
        setDuration("");
        setDifficulty("normal");
        setConcentration("3");
        setContent("");
      }
      router.refresh();
    }
  }, [state, defaultSubjectId, log, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={log ? "ghost" : "default"}>{triggerLabel ?? (log ? "수정" : "+ 공부 기록")}</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{log ? "공부 기록 수정" : "공부 기록 추가"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          {log && <input type="hidden" name="study_log_id" value={log.id} />}
          <div className="space-y-2">
            <Label>과목</Label>
            <select
              name="subject_id"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className={selectClass}
            >
              <option value="">과목 없음</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="study_date">날짜<span className="text-red-500">*</span></Label>
              <Input
                id="study_date"
                name="study_date"
                type="date"
                value={studyDate}
                onChange={(e) => setStudyDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">공부 시간<span className="text-red-500">*</span></Label>
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min="0"
                placeholder="90"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>난이도</Label>
              <select
                name="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={selectClass}
              >
                <option value="easy">쉬움</option>
                <option value="normal">보통</option>
                <option value="hard">어려움</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>집중도</Label>
              <select
                name="concentration_level"
                value={concentration}
                onChange={(e) => setConcentration(e.target.value)}
                className={selectClass}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">내용 (선택)</Label>
            <Input
              id="content"
              name="content"
              placeholder="예: 오답 정리, 개념 복습"
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
