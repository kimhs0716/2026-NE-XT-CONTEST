"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteStudyLog } from "@/lib/actions/study";

export default function StudyLogDeleteButton({ logId }: { logId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await deleteStudyLog(logId);
        router.refresh();
      })}
      className="text-red-500 hover:text-red-600"
    >
      삭제
    </Button>
  );
}
