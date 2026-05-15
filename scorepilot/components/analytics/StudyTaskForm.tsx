"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { addStudyTask, updateStudyTask } from "@/lib/actions/study";
import { commonSubjects } from "@/lib/constants/grades";
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

export type StudyTaskFormValue = {
  id: string;
  subjectId: string | null;
  title: string;
  taskType: string | null;
  dueDate: string | null;
  priority: string | null;
  memo: string | null;
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function StudyTaskForm({
  subjects,
  defaultSubjectName,
  task,
  triggerLabel,
}: {
  subjects: SubjectOption[];
  defaultSubjectName?: string;
  task?: StudyTaskFormValue;
  triggerLabel?: string;
}) {
  const [state, action, pending] = useActionState(task ? updateStudyTask : addStudyTask, null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const handledSuccessRef = useRef(false);
  const subjectByName = new Map(subjects.map((subject) => [subject.name, subject]));
  const subjectNameById = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const initialSubjectName = task?.subjectId
    ? subjectNameById.get(task.subjectId) ?? ""
    : defaultSubjectName ?? commonSubjects[0];
  const initialSubjectMode = commonSubjects.includes(initialSubjectName) ? "select" : "custom";
  const [selectedSubjectName, setSelectedSubjectName] = useState(
    initialSubjectMode === "select" ? initialSubjectName : commonSubjects[0],
  );
  const [subjectMode, setSubjectMode] = useState<"select" | "custom">(initialSubjectMode);
  const [customSubject, setCustomSubject] = useState(
    initialSubjectMode === "custom" ? initialSubjectName : "",
  );
  const [title, setTitle] = useState(task?.title ?? "");
  const [taskType, setTaskType] = useState(task?.taskType ?? "review");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [memo, setMemo] = useState(task?.memo ?? "");

  useEffect(() => {
    if (!state?.success) {
      handledSuccessRef.current = false;
      return;
    }
    if (handledSuccessRef.current) return;

    handledSuccessRef.current = true;
    setOpen(false);
    if (!task) {
      setSelectedSubjectName(commonSubjects[0]);
      setSubjectMode("select");
      setCustomSubject("");
      setTitle("");
      setTaskType("review");
      setDueDate("");
      setPriority("medium");
      setMemo("");
    }
    router.refresh();
  }, [state, task, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={task ? "ghost" : "outline"}>{triggerLabel ?? (task ? "수정" : "+ 할 일")}</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "공부 할 일 수정" : "공부 할 일 추가"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handledSuccessRef.current = false;
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          {task && <input type="hidden" name="study_task_id" value={task.id} />}
          <input
            type="hidden"
            name="subject_id"
            value={subjectMode === "select" ? subjectByName.get(selectedSubjectName)?.id ?? "" : ""}
          />
          <input
            type="hidden"
            name="subject_name"
            value={subjectMode === "select" ? selectedSubjectName : customSubject.trim()}
          />
          <div className="space-y-2">
            <Label>과목</Label>
            <select
              value={subjectMode === "custom" ? "" : selectedSubjectName}
              onChange={(e) => {
                if (!e.target.value) {
                  setSubjectMode("custom");
                  setCustomSubject("");
                  return;
                }
                setSubjectMode("select");
                setSelectedSubjectName(e.target.value);
                setCustomSubject("");
              }}
              className={selectClass}
            >
              {commonSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
              <option value="">기타(직접 입력)</option>
            </select>
            {subjectMode === "custom" ? (
              <Input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="예: 기가, 정보, 한문"
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-title">제목<span className="text-red-500">*</span></Label>
            <Input
              id="task-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 오답노트 2회독"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>종류</Label>
              <select
                name="task_type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className={selectClass}
              >
                <option value="homework">숙제</option>
                <option value="review">복습</option>
                <option value="preview">예습</option>
                <option value="problem_solving">문제 풀이</option>
                <option value="memorization">암기</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>우선순위</Label>
              <select
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={selectClass}
              >
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">마감일</Label>
            <Input
              id="due-date"
              name="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-memo">메모 (선택)</Label>
            <Input
              id="task-memo"
              name="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="준비 범위나 기준"
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
