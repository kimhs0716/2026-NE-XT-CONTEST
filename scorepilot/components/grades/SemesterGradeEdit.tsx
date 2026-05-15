"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { updateSemesterGrade } from "@/lib/actions/grades";

const GRADE_COLORS: Record<string, string> = {
  "1": "text-green-600", A: "text-green-600",
  "2": "text-blue-600",  B: "text-blue-600",
  "3": "text-yellow-600", C: "text-yellow-600",
  "4": "text-orange-500", D: "text-orange-500",
};
function gradeColor(g: string) {
  return GRADE_COLORS[g.trim().toUpperCase()] ?? "text-red-500";
}

export default function SemesterGradeEdit({
  examId,
  initialGrade,
}: {
  examId: string;
  initialGrade: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialGrade ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialGrade ?? "");
  }, [initialGrade]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function save() {
    const trimmed = value.trim() || null;
    startTransition(async () => {
      await updateSemesterGrade(examId, trimmed);
      setEditing(false);
    });
  }

  const grade = (initialGrade ?? "").trim();

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setValue(initialGrade ?? ""); setEditing(false); }
        }}
        disabled={isPending}
        placeholder="1, A …"
        className="w-16 rounded-md border border-input bg-muted/30 px-2 py-1 text-center text-sm outline-none focus:border-foreground/60 focus:ring-0"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group min-w-[64px] rounded-md border border-input bg-muted/30 px-3 py-1.5 text-center transition-colors hover:bg-muted/60 hover:border-foreground/40"
      title="클릭하여 등급 입력"
    >
      {grade ? (
        <span className={`font-bold text-base ${gradeColor(grade)}`}>{grade}</span>
      ) : (
        <span className="text-muted-foreground text-xs">등급 입력</span>
      )}
    </button>
  );
}
