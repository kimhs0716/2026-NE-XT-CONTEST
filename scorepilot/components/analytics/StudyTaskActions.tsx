"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteStudyTask, toggleStudyTaskComplete } from "@/lib/actions/study";

export default function StudyTaskActions({
  taskId,
  isCompleted,
}: {
  taskId: string;
  isCompleted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await toggleStudyTaskComplete(taskId, !isCompleted);
          router.refresh();
        })}
      >
        {isCompleted ? "완료 취소" : "완료"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await deleteStudyTask(taskId);
          router.refresh();
        })}
        className="text-red-500 hover:text-red-600"
      >
        삭제
      </Button>
    </div>
  );
}
