"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardSchedule = {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const EVENT_TYPE_COLOR: Record<string, string> = {
  exam: "bg-blue-100 text-blue-700",
  midterm: "bg-blue-100 text-blue-700",
  final: "bg-violet-100 text-violet-700",
  assignment: "bg-orange-100 text-orange-700",
  mock_exam: "bg-orange-100 text-orange-700",
  study: "bg-cyan-100 text-cyan-700",
  school_academy: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-600",
};

function getWeeks(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = Array(firstDay).fill(null);

  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function DashboardCalendar({
  schedules,
  initialYear,
  initialMonth,
}: {
  schedules: DashboardSchedule[];
  initialYear: number;
  initialMonth: number;
}) {
  const today = new Date();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DashboardSchedule[]>();
    for (const schedule of schedules) {
      if (!map.has(schedule.start_date)) map.set(schedule.start_date, []);
      map.get(schedule.start_date)!.push(schedule);
    }
    return map;
  }, [schedules]);

  const weeks = useMemo(() => getWeeks(year, month), [year, month]);

  const goToPrev = () => {
    if (month === 0) {
      setYear((current) => current - 1);
      setMonth(11);
      return;
    }
    setMonth((current) => current - 1);
  };

  const goToNext = () => {
    if (month === 11) {
      setYear((current) => current + 1);
      setMonth(0);
      return;
    }
    setMonth((current) => current + 1);
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-xs" onClick={goToPrev} aria-label="이전 달">
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-xs" onClick={goToNext} aria-label="다음 달">
            <ChevronRight className="size-3.5" />
          </Button>
          <span className="ml-1 font-medium whitespace-nowrap">
            {year}년 {month + 1}월
          </span>
        </div>
        <Button variant="outline" size="xs" onClick={goToToday}>
          오늘
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-xs font-medium text-muted-foreground py-1 text-center">
            {day}
          </div>
        ))}
        {weeks.map((week, rowIdx) =>
          week.map((day, colIdx) => {
            const dateStr = day
              ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : null;
            const dayEvents = dateStr ? eventsByDate.get(dateStr) ?? [] : [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                className="min-h-[80px] border rounded p-1 flex flex-col gap-1"
              >
                <div
                  className={`text-xs font-medium ${
                    isToday
                      ? "inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}
                >
                  {day ?? ""}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 text-[10px] min-h-0 overflow-hidden">
                  {dayEvents.slice(0, 2).map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`truncate px-1 py-0.5 rounded ${
                        EVENT_TYPE_COLOR[schedule.event_type] ?? EVENT_TYPE_COLOR.other
                      }`}
                    >
                      {schedule.title}
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
  );
}
