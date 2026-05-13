"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2"];

type Props = {
  chartData: Record<string, string | number | null>[];
  overallScore: number;
  overallGradeStorageKey: string;
  examTypeLabels: Record<string, string>;
};

export default function SubjectCharts({
  chartData,
  overallScore,
  overallGradeStorageKey,
  examTypeLabels,
}: Props) {
  const barKeys = Object.values(examTypeLabels);
  const safeOverallScore = Math.max(0, Math.min(100, overallScore));
  const [overallGrade, setOverallGrade] = useState("");
  const storageKey = `scorepilot:overall-grade:${overallGradeStorageKey}`;
  const overallData = [
    { name: "종합 점수", value: safeOverallScore, color: "#2563eb" },
    { name: "미반영 구간", value: 100 - safeOverallScore, color: "#e5e7eb" },
  ];

  useEffect(() => {
    queueMicrotask(() => {
      setOverallGrade(window.localStorage.getItem(storageKey) ?? "");
    });
  }, [storageKey]);

  function handleOverallGradeChange(value: string) {
    setOverallGrade(value);
    if (value.trim()) {
      window.localStorage.setItem(storageKey, value);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
        성적을 추가하면 그래프가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold">시험 별 성적</h2>
        <div className="pointer-events-none">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} width={44} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {barKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="mb-4 text-base font-semibold">종합 점수</h2>
        <div className="flex items-center gap-6">
          <div className="relative h-[220px] w-[60%] min-w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overallData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {overallData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground">
                {safeOverallScore.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">점</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 flex-shrink-0 rounded-sm bg-blue-600" />
              <span className="text-muted-foreground">종합 점수</span>
              <span className="ml-auto font-semibold">{safeOverallScore.toFixed(1)}점</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overall_grade" className="text-xs text-muted-foreground">
                종합 등급
              </Label>
              <Input
                id="overall_grade"
                value={overallGrade}
                onChange={(event) => handleOverallGradeChange(event.target.value)}
                placeholder="직접 입력"
                className="h-9"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
