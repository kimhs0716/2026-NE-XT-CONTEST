"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type Props = {
  subjects: string[];
  currentSubject?: string;
};

export default function AnalysisModeSelect({ subjects, currentSubject }: Props) {
  const router = useRouter();
  const currentValue = currentSubject
    ? `/analytics/${encodeURIComponent(currentSubject)}`
    : "/analytics";

  const currentLabel = currentSubject ? `${currentSubject} 분석` : "전체 분석";

  return (
    <Select
      value={currentValue}
      onValueChange={(value) => {
        if (value && value !== currentValue) router.push(value);
      }}
    >
      <SelectTrigger
        className="h-9 min-w-36 bg-white"
        aria-label="분석 화면 선택"
      >
        <span>{currentLabel}</span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="/analytics" label="전체 분석">
          전체 분석
        </SelectItem>
        {subjects.map((subject) => {
          const value = `/analytics/${encodeURIComponent(subject)}`;
          return (
            <SelectItem key={subject} value={value} label={`${subject} 분석`}>
              {subject} 분석
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
