"use client";

import { useState } from "react";
import GradeChart from "./GradeChart";

type DataPoint = Record<string, string | number | null>;

function buildCategoryData(
  data: DataPoint[],
  subjects: string[],
  categoryMap: Record<string, string>,
): { data: DataPoint[]; categories: string[] } {
  const categoryGroups: Record<string, string[]> = {};
  for (const s of subjects) {
    const cat = categoryMap[s] ?? s;
    if (!categoryGroups[cat]) categoryGroups[cat] = [];
    categoryGroups[cat].push(s);
  }
  const cats = Object.keys(categoryGroups);

  const aggregated = data.map((row) => {
    const next: DataPoint = { semester: row.semester };
    for (const cat of cats) {
      const vals = categoryGroups[cat]
        .map((s) => row[s])
        .filter((v): v is number => typeof v === "number");
      next[cat] = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : null;
    }
    const allVals = cats
      .map((cat) => next[cat])
      .filter((v): v is number => typeof v === "number");
    next["전체 평균"] =
      allVals.length > 1
        ? Math.round((allVals.reduce((a, b) => a + b, 0) / allVals.length) * 10) / 10
        : null;
    return next;
  });

  return { data: aggregated, categories: cats };
}

export default function GradeChartWithFilter({
  data,
  subjects,
  categoryMap,
  categories,
  overallAvg,
}: {
  data: DataPoint[];
  subjects: string[];
  categoryMap: Record<string, string>;
  categories: string[];
  overallAvg: number | null;
}) {
  const [selected, setSelected] = useState<string>("all");

  const categoryAgg = buildCategoryData(data, subjects, categoryMap);

  // 항상 카테고리 집계 데이터 사용 — 선택한 분류만 라인으로 표시
  const filteredSubjects =
    selected === "all" ? categoryAgg.categories : [selected];

  const filteredData =
    selected === "all"
      ? categoryAgg.data
      : categoryAgg.data.map((row) => ({
          ...row,
          "전체 평균": null, // 단일 분류 선택 시 전체 평균선 숨김
        }));

  const filteredAvg =
    selected === "all"
      ? overallAvg
      : (() => {
          const vals = categoryAgg.data
            .map((row) => row[selected])
            .filter((v): v is number => typeof v === "number");
          return vals.length
            ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
            : null;
        })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelected("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              selected === "all"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelected(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selected === cat
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {filteredAvg !== null && (
          <span className="text-sm text-muted-foreground">
            {selected === "all" ? "전체" : selected} 평균{" "}
            <span className="font-semibold text-foreground">{filteredAvg}등급</span>
          </span>
        )}
      </div>
      <GradeChart data={filteredData} subjects={filteredSubjects} />
    </div>
  );
}
