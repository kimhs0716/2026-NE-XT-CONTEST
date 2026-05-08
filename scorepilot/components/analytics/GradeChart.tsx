"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#9333ea", "#0891b2", "#db2777", "#65a30d",
];

type Props = {
  data: Record<string, string | number>[];
  subjects: string[];
};

export default function GradeChart({ data, subjects }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        성적을 입력하면 추이 그래프가 표시됩니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${v}%`}
          width={48}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number" ? [`${value.toFixed(1)}%`] : [value]
          }
        />
        <Legend />
        {subjects.map((subject, i) => (
          <Line
            key={subject}
            type="monotone"
            dataKey={subject}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
