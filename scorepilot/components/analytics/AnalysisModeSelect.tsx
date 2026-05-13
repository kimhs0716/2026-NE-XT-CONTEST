"use client";

import { useRouter } from "next/navigation";

type Props = {
  subjects: string[];
  currentSubject?: string;
};

export default function AnalysisModeSelect({ subjects, currentSubject }: Props) {
  const router = useRouter();
  const currentValue = currentSubject
    ? `/analytics/${encodeURIComponent(currentSubject)}`
    : "/analytics";

  return (
    <select
      value={currentValue}
      onChange={(e) => router.push(e.target.value)}
      className="h-9 rounded-lg border border-input bg-white px-3 text-sm font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="분석 화면 선택"
    >
      <option value="/analytics">전체 분석</option>
      {subjects.map((subject) => (
        <option key={subject} value={`/analytics/${encodeURIComponent(subject)}`}>
          {subject} 분석
        </option>
      ))}
    </select>
  );
}
