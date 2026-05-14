"use client";

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

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2"];

type Props = {
  chartData: Record<string, string | number | null>[];
  pieData: { name: string; value: number }[];
  examTypeLabels: Record<string, string>;
};

export default function SubjectCharts({ chartData, pieData, examTypeLabels }: Props) {
  const barKeys = Object.values(examTypeLabels);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
        성적을 추가하면 그래프가 표시됩니다
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 막대 그래프 */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-4">막대 그래프</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}점`} width={44} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)}점`]}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {barKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 원 그래프 */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-4">원 그래프</h2>
        {pieData.length > 0 ? (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)}점`, "평균"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-semibold ml-auto">{d.value}점</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            데이터 없음
          </div>
        )}
      </div>
    </div>
  );
}
