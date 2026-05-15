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

export const CHART_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#9333ea", "#0891b2", "#db2777", "#65a30d",
];

type TooltipEntry = { name: string; value: number; color: string };

function ChartTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  mode: "grade" | "score";
}) {
  if (!active || !payload?.length) return null;
  const unit = mode === "grade" ? "등급" : "점";
  const subjectEntries = payload.filter(
    (e) => e.name !== "전체 평균" && e.value != null,
  );
  const avg = payload.find((e) => e.name === "전체 평균");
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5 shadow-md text-sm min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {subjectEntries.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium pl-4">
            {Number(entry.value).toFixed(1)}{unit}
          </span>
        </div>
      ))}
      {avg?.value != null && subjectEntries.length > 1 && (
        <div className="flex items-center gap-2 pt-1.5 mt-1 border-t">
          <span className="text-muted-foreground">전체 평균</span>
          <span className="ml-auto font-medium pl-4">
            {Number(avg.value).toFixed(1)}{unit}
          </span>
        </div>
      )}
    </div>
  );
}

type DataPoint = Record<string, string | number | null>;

type Props = {
  data: DataPoint[];
  subjects: string[];
  mode?: "grade" | "score";
};

export default function GradeChart({ data, subjects, mode = "grade" }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        {mode === "grade"
          ? "성적과 등급을 입력하면 추이 그래프가 표시됩니다"
          : "성적을 입력하면 추이 그래프가 표시됩니다"}
      </div>
    );
  }

  const isGrade = mode === "grade";

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="semester"
          tick={{ fontSize: 12 }}
          padding={{ left: 20, right: 20 }}
        />
        <YAxis
          domain={isGrade ? [1, 9] : [0, 100]}
          reversed={isGrade}
          ticks={isGrade ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 25, 50, 75, 100]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => isGrade ? `${v}등급` : `${v}점`}
          width={52}
        />
        <Tooltip content={<ChartTooltip mode={mode} />} />
        <Legend />
        {subjects.map((subject, i) => (
          <Line
            key={subject}
            type="linear"
            dataKey={subject}
            name={subject}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        ))}
        <Line
          type="linear"
          dataKey="전체 평균"
          name="전체 평균"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls={false}
        />
      </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
