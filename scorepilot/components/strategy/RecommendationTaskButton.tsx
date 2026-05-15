"use client";

import { useState, useTransition } from "react";
import { addRecommendationAsTask } from "@/lib/actions/study";
import { Button } from "@/components/ui/button";

export default function RecommendationTaskButton({
  subjectId,
  title,
  description,
  priority,
}: {
  subjectId: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending || added}
        onClick={() => {
          setMessage(null);
          const formData = new FormData();
          if (subjectId) formData.set("subject_id", subjectId);
          formData.set("title", title);
          formData.set("description", description);
          formData.set("priority", priority);
          startTransition(async () => {
            const result = await addRecommendationAsTask(formData);
            if (result?.error) {
              setMessage(result.error);
              return;
            }
            setAdded(true);
            setMessage("할 일에 추가됨");
          });
        }}
      >
        {isPending ? "추가 중..." : added ? "추가됨" : "할 일로 추가"}
      </Button>
      {message && (
        <span className="text-xs text-muted-foreground">
          {message}
        </span>
      )}
    </div>
  );
}
