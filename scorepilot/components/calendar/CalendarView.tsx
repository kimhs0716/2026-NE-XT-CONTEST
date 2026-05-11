"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { examTypeLabels, type ExamType } from "@/lib/constants/grades";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const examTypePillClass: Record<ExamType, string> = {
  midterm: "bg-blue-100 text-blue-700",
  final: "bg-violet-100 text-violet-700",
  mock_exam: "bg-orange-100 text-orange-700",
  assignment: "bg-green-100 text-green-700",
  other: "bg-gray-100 text-gray-600",
};

export type CalendarEvent = {
  date: string;
  subject: string;
  examType: ExamType;
  percentage: number;
};

export default function CalendarView({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [events]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const goToPrev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const goToNext = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };
  const goToToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthEvents = events
    .filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-lg font-semibold ml-1">
            {year}년 {month + 1}월
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          오늘
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center py-2.5 text-xs font-medium",
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 divide-x divide-y">
          {cells.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[88px] bg-muted/10" />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSun = i % 7 === 0;
            const isSat = i % 7 === 6;

            return (
              <div key={i} className="min-h-[88px] p-1.5 space-y-1 bg-white">
                <span
                  className={cn(
                    "inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : isSun
                      ? "text-red-500"
                      : isSat
                      ? "text-blue-500"
                      : "text-foreground",
                  )}
                >
                  {day}
                </span>
                {dayEvents.slice(0, 2).map((e, j) => (
                  <div
                    key={j}
                    title={`${e.subject} ${examTypeLabels[e.examType]} (${e.percentage.toFixed(1)}%)`}
                    className={cn(
                      "text-xs truncate rounded px-1 py-0.5 cursor-default",
                      examTypePillClass[e.examType],
                    )}
                  >
                    {e.subject}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - 2}개 더
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* This month's event list */}
      {monthEvents.length > 0 && (
        <div className="rounded-xl border bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {month + 1}월 시험 목록
          </h3>
          <div className="space-y-2">
            {monthEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs w-20 shrink-0">{e.date}</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-xs", examTypePillClass[e.examType])}>
                    {examTypeLabels[e.examType]}
                  </span>
                  <span className="font-medium">{e.subject}</span>
                </div>
                <span
                  className={cn(
                    "font-medium text-sm",
                    e.percentage >= 80
                      ? "text-green-600"
                      : e.percentage >= 60
                      ? "text-yellow-600"
                      : "text-red-500",
                  )}
                >
                  {e.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.entries(examTypeLabels) as [ExamType, string][]).map(([type, label]) => (
          <span key={type} className={cn("text-xs px-2 py-0.5 rounded", examTypePillClass[type])}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
