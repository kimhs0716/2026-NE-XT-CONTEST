"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/components/analytics/GradeChart";
import type { ExamType } from "@/lib/constants/grades";

export type GradeTrendSourceRow = {
  subjectName: string;
  category: string;
  semesterKey: string;
  semesterLabel: string;
  semOrder: number;
  examType: ExamType;
  gradeLevel: string | null;
  createdAt: string;
};

type Props = {
  rows: GradeTrendSourceRow[];
  categories: string[];
};

type ChartRow = Record<string, string | number | null>;

type TooltipEntry = { name: string; value: number; color: string };

function currentSemesterKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 3 && month <= 7) return `${year}-semester_1`;
  if (month >= 8 && month <= 12) return `${year}-semester_2`;
  return `${year - 1}-semester_2`;
}

function parseGrade(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const grade = Number(match[0]);
  return Number.isFinite(grade) && grade >= 1 && grade <= 9 ? grade : null;
}

function examOrder(type: ExamType) {
  if (type === "final") return 2;
  if (type === "midterm") return 1;
  return 0;
}

function examLabel(type: ExamType) {
  if (type === "final") return "기말";
  if (type === "midterm") return "중간";
  return "시험";
}

function uniqueLabels<T extends { label: string }>(points: T[]): T[] {
  const total = points.reduce<Record<string, number>>((acc, point) => {
    acc[point.label] = (acc[point.label] ?? 0) + 1;
    return acc;
  }, {});
  const count: Record<string, number> = {};
  return points.map((point) => {
    count[point.label] = (count[point.label] ?? 0) + 1;
    return total[point.label] > 1
      ? { ...point, label: `${point.label} ${count[point.label]}차` }
      : point;
  });
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter((entry) => entry.value != null);
  if (entries.length === 0) return null;

  return (
    <div className="min-w-[150px] rounded-lg border bg-white px-3 py-2.5 text-sm shadow-md">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      {entries.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto pl-4 font-medium">{Number(entry.value).toFixed(1)}등급</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalysisGradeTrendChart({ rows, categories }: Props) {
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const semesterKey = useMemo(() => currentSemesterKey(), []);

  useEffect(() => {
    queueMicrotask(() => {
      const points: Array<{
        label: string;
        category: string;
        value: number;
        order: number;
      }> = [];

      const currentRows = rows.filter(
        (row) => row.semesterKey === semesterKey && (row.examType === "midterm" || row.examType === "final"),
      );
      const currentBySubject = new Map<string, GradeTrendSourceRow>();
      for (const row of currentRows) {
        if (parseGrade(row.gradeLevel) == null) continue;
        const key = `${row.category}:${row.subjectName}`;
        const previous = currentBySubject.get(key);
        if (
          !previous ||
          examOrder(row.examType) > examOrder(previous.examType) ||
          (examOrder(row.examType) === examOrder(previous.examType) && row.createdAt > previous.createdAt)
        ) {
          currentBySubject.set(key, row);
        }
      }

      for (const row of currentBySubject.values()) {
        const grade = parseGrade(row.gradeLevel);
        if (grade == null) continue;
        points.push({
          label: `${row.semesterLabel} ${examLabel(row.examType)} ${row.subjectName}`,
          category: row.category,
          value: grade,
          order: row.semOrder * 1000 + examOrder(row.examType),
        });
      }

      const pastSubjects = new Map<string, GradeTrendSourceRow>();
      for (const row of rows) {
        if (row.semesterKey >= semesterKey) continue;
        const key = `${row.category}:${row.subjectName}:${row.semesterKey}`;
        const previous = pastSubjects.get(key);
        if (!previous || row.createdAt > previous.createdAt) {
          pastSubjects.set(key, row);
        }
      }

      for (const row of pastSubjects.values()) {
        const savedGrade = window.localStorage.getItem(`scorepilot:overall-grade:${row.subjectName}:${row.semesterKey}`);
        const grade = parseGrade(savedGrade);
        if (grade == null) continue;
        points.push({
          label: `${row.semesterLabel} 종합 ${row.subjectName}`,
          category: row.category,
          value: grade,
          order: row.semOrder * 1000 + 900,
        });
      }

      const sorted = uniqueLabels(points.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "ko")));
      setChartData(sorted.map((point) => ({
        semester: point.label,
        ...Object.fromEntries(categories.map((category) => [category, category === point.category ? point.value : null])),
      })));
    });
  }, [categories, rows, semesterKey]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-center text-sm text-muted-foreground">
        현재 학기는 중간/기말 등급을, 지난 학기는 과목 홈의 종합 등급을 입력하면 추이가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="semester" tick={{ fontSize: 12 }} padding={{ left: 20, right: 20 }} />
          <YAxis
            domain={[1, 9]}
            reversed
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value}등급`}
            width={58}
          />
          <Tooltip content={<TrendTooltip />} />
          <Legend />
          {categories.map((category, index) => (
            <Line
              key={category}
              type="linear"
              dataKey={category}
              name={category}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
