"use client";

import {
  ComposedChart,
  Line,
  ReferenceLine,
  ReferenceDot,
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
  chartSeries: { key: string; label: string; isCurrent: boolean }[];
  currentSemester: string | null;
  pieData: { name: string; value: number; color?: string; hidden?: boolean }[];
  pieSummary: { score: number; maxScore: number; percentage: number } | null;
};

export default function SubjectCharts({
  chartData,
  chartSeries = [],
  currentSemester,
  pieData,
  pieSummary,
}: Props) {
  const visiblePieData = pieData.filter((d) => !d.hidden);
  const currentSeries = chartSeries.find((series) => series.isCurrent);
  const otherSeries = chartSeries.filter((series) => !series.isCurrent);
  const currentPointValue =
    currentSeries && currentSemester
      ? Number(chartData.find((row) => row.semester === currentSemester)?.[currentSeries.key])
      : null;
  const hasCurrentPoint =
    currentPointValue !== null && Number.isFinite(currentPointValue) && currentPointValue > 0;

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">
        성적을 추가하면 그래프가 표시됩니다
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 꺾은선 그래프 */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-4">같은 분류 총점 추이</h2>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 18, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}점`} width={44} />
            <Tooltip
              formatter={(value, name) => {
                if (value == null || Number(value) === 0) return null;
                return [`${Number(value).toFixed(1)}점`, name];
              }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {currentSemester && hasCurrentPoint && (
              <ReferenceLine
                segment={[
                  { x: currentSemester, y: 0 },
                  { x: currentSemester, y: currentPointValue },
                ]}
                stroke="#111827"
                strokeWidth={2}
              />
            )}
            {currentSemester && hasCurrentPoint && (
              <ReferenceDot
                x={currentSemester}
                y={currentPointValue}
                r={0}
                label={{ value: "현재", position: "top", fill: "#111827", fontSize: 11, fontWeight: 700 }}
              />
            )}
            {otherSeries.map((series, i) => (
              <Line
                key={series.key}
                type="linear"
                dataKey={series.key}
                name={series.label}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
            {currentSeries && (
              <Line
                type="linear"
                dataKey={currentSeries.key}
                name={`${currentSeries.label} (현재)`}
                stroke="#111827"
                strokeWidth={3}
                dot={{ r: 4, fill: "#111827", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 원 그래프 */}
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-4">총점/만점</h2>
        {pieData.length > 0 && pieSummary ? (
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
                    <Cell key={i} fill={pieData[i].color ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const item = pieData.find((d) => d.name === name);
                    if (item?.hidden) return null;
                    return [`${Number(value).toFixed(1)}점`];
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">총점 / 만점</p>
                <p className="text-2xl font-bold">
                  {pieSummary.score.toFixed(1)} / {pieSummary.maxScore.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{pieSummary.percentage.toFixed(1)}%</p>
              </div>
              {visiblePieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: d.color ?? COLORS[i % COLORS.length] }}
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
