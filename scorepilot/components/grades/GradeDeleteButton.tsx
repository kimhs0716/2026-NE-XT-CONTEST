"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteGrade } from "@/lib/actions/grades";

export default function GradeDeleteButton({ examId }: { examId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await deleteGrade(examId);
        router.refresh();
      })}
      className="text-red-500 hover:text-red-600"
    >
      삭제
    </Button>
  );
}
