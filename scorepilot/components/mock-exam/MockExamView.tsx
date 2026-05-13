"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMockExamRecord, deleteMockExamRecord } from "@/lib/actions/mock-exam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type MockExamRecord = {
  id: string;
  exam_year: number;
  exam_month: number;
  subject: string;
  raw_score: number | null;
  percentile: number | null;
  grade: number | null;
  target_score: number | null;
};

const SUBJECTS = ["국어", "수학", "영어", "한국사", "탐구1", "탐구2", "제2외국어"];
const MONTHS = [3, 4, 5, 6, 7, 9, 10, 11];

const GRADE_COLOR: Record<number, string> = {
  1: "text-green-600",
  2: "text-green-500",
  3: "text-blue-600",
  4: "text-blue-500",
  5: "text-yellow-600",
  6: "text-yellow-500",
  7: "text-orange-500",
  8: "text-red-500",
  9: "text-red-600",
};

const GRADE_BASED_SUBJECTS = new Set(["영어", "한국사"]);
const NO_PERCENTILE_SUBJECTS = new Set(["영어", "한국사", "제2외국어"]);

function ScoreDonut({ record, subject }: { record: MockExamRecord | undefined; subject: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const usesGrade = GRADE_BASED_SUBJECTS.has(subject);
  const value = usesGrade ? record?.grade ?? null : record?.percentile ?? null;
  const fraction =
    value == null
      ? 0
      : usesGrade
        ? Math.max(0, Math.min(1, (10 - value) / 9))
        : Math.max(0, Math.min(1, value / 100));
  const dashArray = `${fraction * circ} ${circ}`;
  const color =
    value == null ? "#e5e7eb"
    : usesGrade
      ? value <= 2 ? "#16a34a"
      : value <= 4 ? "#2563eb"
      : value <= 6 ? "#ca8a04"
      : value <= 8 ? "#ea580c"
      : "#dc2626"
    : value >= 90 ? "#16a34a"
    : value >= 75 ? "#2563eb"
    : value >= 50 ? "#ca8a04"
    : value >= 25 ? "#ea580c"
    : "#dc2626";
  const displayValue =
    value != null
      ? usesGrade
        ? value.toString()
        : Number(value.toFixed(1)).toLocaleString("ko-KR")
      : "-";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={dashArray}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>
          {displayValue}
        </text>
      </svg>
      <span className="text-xs font-medium text-muted-foreground">{subject}</span>
      {record?.raw_score != null && (
        <span className="text-xs font-bold" style={{ color }}>
          {record.raw_score}점
        </span>
      )}
    </div>
  );
}

function SaveButton({ formId }: { formId: string }) {
  return (
    <Button form={formId} type="submit" variant="outline" size="sm">
      저장
    </Button>
  );
}

export default function MockExamView({ records }: { records: MockExamRecord[] }) {
  const router = useRouter();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(MONTHS.find((m) => m <= now.getMonth() + 1) ?? MONTHS[0]);
  const [isPending, startTrans] = useTransition();

  const filtered = records.filter(
    (r) => r.exam_year === selectedYear && r.exam_month === selectedMonth
  );

  const recordMap = new Map(filtered.map((r) => [r.subject, r]));

  const yearOptions: number[] = [];
  const minYear = Math.min(...records.map((r) => r.exam_year), now.getFullYear() - 2);
  for (let y = now.getFullYear(); y >= minYear; y--) yearOptions.push(y);

  const selectClass = "h-9 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring";

  return (
    <div className="space-y-6">
      {/* 연도/월 선택 */}
      <div className="flex items-center gap-3">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className={selectClass}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}년도</option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          className={selectClass}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}월</option>
          ))}
        </select>
      </div>

      {/* 백분위/등급 도넛 차트 */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-5">
          {selectedYear}년 {selectedMonth}월 모의고사 — 과목별 백분위/등급
        </h2>
        <div className="flex items-center justify-around flex-wrap gap-4">
          {SUBJECTS.filter((s) => s !== "제2외국어").map((subject) => (
            <ScoreDonut
              key={subject}
              subject={subject}
              record={recordMap.get(subject)}
            />
          ))}
        </div>
      </div>

      {/* 성적 테이블 */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{selectedYear}년 {selectedMonth}월 성적 상세</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] table-fixed text-sm">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[110px]" />
              <col className="w-[130px]" />
              <col className="w-[160px]" />
            </colgroup>
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="px-2 pb-2 font-medium">과목</th>
                <th className="px-2 pb-2 font-medium text-center">원점수</th>
                <th className="px-2 pb-2 font-medium text-center">백분위</th>
                <th className="px-2 pb-2 font-medium text-center">등급</th>
                <th className="px-2 pb-2 font-medium text-center">목표점수</th>
                <th className="px-2 pb-2 font-medium text-right" />
              </tr>
            </thead>
            <tbody>
              {SUBJECTS.map((subject, index) => {
                const record = recordMap.get(subject);
                const formId = `mock-exam-row-${index}`;
                const usesPercentile = !NO_PERCENTILE_SUBJECTS.has(subject);
                const rowKey = [
                  selectedYear,
                  selectedMonth,
                  subject,
                  record?.id ?? "new",
                  record?.raw_score ?? "",
                  record?.percentile ?? "",
                  record?.grade ?? "",
                  record?.target_score ?? "",
                ].join("-");

                return (
                  <tr key={rowKey} className="border-b last:border-0">
                    <td className="px-2 py-2.5 font-medium">
                      {subject}
                      <form id={formId} action={saveMockExamRecord}>
                        <input type="hidden" name="exam_year" value={selectedYear} />
                        <input type="hidden" name="exam_month" value={selectedMonth} />
                        <input type="hidden" name="subject" value={subject} />
                      </form>
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        form={formId}
                        name="raw_score"
                        type="number"
                        min="0"
                        max="100"
                        defaultValue={record?.raw_score ?? ""}
                        placeholder="0-100"
                        className="h-8 w-full text-right"
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      {usesPercentile ? (
                        <Input
                          form={formId}
                          name="percentile"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={record?.percentile ?? ""}
                          placeholder="0-100"
                          className="h-8 w-full text-right"
                        />
                      ) : (
                        <div className="h-8 w-full rounded-lg border border-transparent" />
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        form={formId}
                        name="grade"
                        type="number"
                        min="1"
                        max="9"
                        defaultValue={record?.grade ?? ""}
                        placeholder="1-9"
                        className={`h-8 w-full text-right ${
                          record?.grade != null ? (GRADE_COLOR[record.grade] ?? "") : ""
                        }`}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <Input
                        form={formId}
                        name="target_score"
                        type="number"
                        min="0"
                        max="100"
                        defaultValue={record?.target_score ?? ""}
                        placeholder="0-100"
                        className="h-8 w-full text-right"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <SaveButton formId={formId} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending || !record}
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            if (!record) return;
                            startTrans(async () => {
                              await deleteMockExamRecord(record.id);
                              router.refresh();
                            });
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
