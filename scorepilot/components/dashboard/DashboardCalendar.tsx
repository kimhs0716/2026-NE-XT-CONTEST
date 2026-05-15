"use client";

import { useState } from "react";
import Link from "next/link";

type ScheduleEvent = {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
};

const EVENT_TYPE_COLOR: Record<string, string> = {
  exam: "bg-blue-100 text-blue-700",
  assignment: "bg-orange-100 text-orange-700",
  mock_exam: "bg-purple-100 text-purple-700",
  study: "bg-green-100 text-green-700",
  school_academy: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DashboardCalendar({
  schedules,
  initialYear,
  initialMonth,
  todayStr,
}: {
  schedules: ScheduleEvent[];
  initialYear: number;
  initialMonth: number; // 0-indexed
  todayStr: string; // "YYYY-MM-DD"
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">캘린더</h2>
        <Link href="/calendar" className="text-xs text-primary hover:underline">
          전체 보기 →
        </Link>
      </div>
      <div className="space-y-3">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-base"
            aria-label="이전 달"
          >
            ‹
          </button>
          <span className="font-semibold">{year}년 {month + 1}월</span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground text-base"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-xs font-medium py-1 text-center ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-muted-foreground"
              }`}
            >
              {d}
            </div>
          ))}

          {/* 날짜 셀 */}
          {weeks.map((week, rowIdx) =>
            week.map((day, colIdx) => {
              const dateStr = day
                ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                : null;
              const dayEvents = dateStr
                ? schedules.filter((s) => s.start_date === dateStr)
                : [];
              const isToday = dateStr === todayStr;
              const isSunday = colIdx === 0;
              const isSaturday = colIdx === 6;

              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className="min-h-[80px] border rounded p-1 flex flex-col gap-1"
                >
                  <div className="flex justify-center">
                    <span
                      className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : isSunday
                          ? "text-red-400"
                          : isSaturday
                          ? "text-blue-400"
                          : "text-foreground"
                      }`}
                    >
                      {day ?? ""}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 text-[10px] min-h-0 overflow-hidden">
                    {dayEvents.slice(0, 2).map((s, i) => (
                      <div
                        key={i}
                        className={`truncate px-1 py-0.5 rounded ${
                          EVENT_TYPE_COLOR[s.event_type] ?? EVENT_TYPE_COLOR.other
                        }`}
                      >
                        {s.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-muted-foreground px-1">
                        +{dayEvents.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
