"use client";

import { useState, useTransition } from "react";
import { generateWeaknessRecommendations } from "@/lib/actions/weakness";
import { Button } from "@/components/ui/button";

export default function GenerateRecommendationsButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await generateWeaknessRecommendations();
            if (result?.error) {
              setMessage(result.error);
              return;
            }
            setMessage("추천을 업데이트했습니다.");
          });
        }}
        disabled={isPending}
      >
        {isPending ? "생성 중..." : "추천 만들기"}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
