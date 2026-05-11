"use client";

import { useState, useMemo, useActionState, useTransition, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { commonSubjects } from "@/lib/constants/grades";
import { addSchedule, deleteSchedule, toggleScheduleComplete } from "@/lib/actions/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const SCHEDULE_EVENT_TYPES = [
  { value: "exam", label: "시험" },
  { value: "assignment", label: "수행평가" },
  { value: "mock_exam", label: "모의고사" },
  { value: "study", label: "공부" },
  { value: "school_academy", label: "학원" },
  { value: "other", label: "기타" },
];

const EVENT_TYPE_PILL: Record<string, string> = {
  midterm: "bg-blue-100 text-blue-700",
  final: "bg-violet-100 text-violet-700",
  mock_exam: "bg-orange-100 text-orange-700",
  assignment: "bg-green-100 text-green-700",
  study: "bg-cyan-100 text-cyan-700",
  school_academy: "bg-purple-100 text-purple-700",
  exam: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-600",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  midterm: "중간고사",
  final: "기말고사",
  mock_exam: "모의고사",
  assignment: "수행평가",
  study: "공부",
  school_academy: "학원",
  exam: "시험",
  other: "기타",
};

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  eventType: string;
  percentage: number | null;
  isGrade: boolean;
  isCompleted?: boolean;
  description?: string;
  subjectName?: string;
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function AddScheduleDialog({
  date,
  subjects,
  onClose,
}: {
  date: string;
  subjects: string[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(addSchedule, null);
  const [subjectMode, setSubjectMode] = useState<"none" | "select" | "custom">("none");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [customSubject, setCustomSubject] = useState("");

  useEffect(() => {
    if (state?.success) onClose();
  }, [state]);

  const subjectOptions = [...new Set([...commonSubjects, ...subjects])];
  const subjectName =
    subjectMode === "select"
      ? selectedSubject
      : subjectMode === "custom"
      ? customSubject
      : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>일정 추가</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label htmlFor="sched-title">제목</Label>
            <Input id="sched-title" name="title" placeholder="예: 수학 중간고사" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>일정 종류</Label>
            <select name="event_type" defaultValue="exam" className={selectClass}>
              {SCHEDULE_EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched-date">날짜</Label>
            <Input id="sched-date" name="start_date" type="date" defaultValue={date} required />
          </div>
          <div className="space-y-2">
            <Label>과목 (선택)</Label>
            <select
              value={
                subjectMode === "none"
                  ? ""
                  : subjectMode === "custom"
                  ? "__custom__"
                  : selectedSubject
              }
              onChange={(e) => {
                if (!e.target.value) {
                  setSubjectMode("none");
                } else if (e.target.value === "__custom__") {
                  setSubjectMode("custom");
                  setSelectedSubject("");
                } else {
                  setSubjectMode("select");
                  setSelectedSubject(e.target.value);
                }
              }}
              className={selectClass}
            >
              <option value="">과목 없음</option>
              {subjectOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__custom__">직접 입력...</option>
            </select>
            {subjectMode === "custom" && (
              <Input
                placeholder="과목명 입력"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched-desc">메모 (선택)</Label>
            <Input id="sched-desc" name="description" placeholder="범위, 준비사항 등" />
          </div>
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventDetailDialog({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteSchedule(event.id);
      onClose();
    });
  };

  const handleToggle = () => {
    startTransition(async () => {
      await toggleScheduleComplete(event.id, !event.isCompleted);
      onClose();
    });
  };

  const pillClass = EVENT_TYPE_PILL[event.eventType] ?? "bg-gray-100 text-gray-600";
  const typeLabel = EVENT_TYPE_LABEL[event.eventType] ?? event.eventType;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">날짜</span>
            <span>{event.date}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">종류</span>
            <span className={cn("px-2 py-0.5 rounded text-xs", pillClass)}>{typeLabel}</span>
          </div>
          {event.subjectName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">과목</span>
              <span>{event.subjectName}</span>
            </div>
          )}
          {event.isGrade && event.percentage !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">성적</span>
              <span
                className={cn(
                  "font-semibold",
                  event.percentage >= 80
                    ? "text-green-600"
                    : event.percentage >= 60
                    ? "text-yellow-600"
                    : "text-red-500",
                )}
              >
                {event.percentage.toFixed(1)}%
              </span>
            </div>
          )}
          {!event.isGrade && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">상태</span>
              <span className={event.isCompleted ? "text-green-600" : "text-muted-foreground"}>
                {event.isCompleted ? "완료" : "예정"}
              </span>
            </div>
          )}
          {event.description && (
            <div className="pt-2 border-t">
              <p className="text-muted-foreground text-xs">{event.description}</p>
            </div>
          )}
          {event.isGrade && (
            <p className="text-xs text-muted-foreground pt-1 border-t">
              성적 수정은 성적 페이지에서 가능합니다.
            </p>
          )}
        </div>
        <div className="flex justify-between mt-4 pt-4 border-t gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            닫기
          </Button>
          {!event.isGrade && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggle}
                disabled={pending}
                className={
                  event.isCompleted
                    ? "text-muted-foreground"
                    : "text-green-600 border-green-200 hover:bg-green-50"
                }
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {event.isCompleted ? "완료 취소" : "완료"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
                삭제
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarView({
  events,
  subjects,
}: {
  events: CalendarEvent[];
  subjects: string[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

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

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthEvents = events
    .filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              오늘
            </Button>
            <Button size="sm" onClick={() => setSelectedDate(todayStr)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              일정 추가
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="rounded-xl border overflow-hidden">
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

          <div className="grid grid-cols-7 divide-x divide-y">
            {cells.map((day, i) => {
              if (!day) {
                return <div key={i} className="min-h-[96px] bg-muted/10" />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const isSun = i % 7 === 0;
              const isSat = i % 7 === 6;

              return (
                <div key={i} className="min-h-[96px] p-1.5 space-y-1 bg-white group">
                  <div className="flex items-center justify-between">
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
                    <button
                      onClick={() => setSelectedDate(dateStr)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {dayEvents.slice(0, 2).map((e, j) => (
                    <button
                      key={j}
                      onClick={() => setSelectedEvent(e)}
                      title={`${e.title}${e.percentage !== null ? ` (${e.percentage.toFixed(1)}%)` : ""}`}
                      className={cn(
                        "w-full text-left text-xs truncate rounded px-1 py-0.5",
                        e.isCompleted && !e.isGrade ? "opacity-60 line-through" : "",
                        EVENT_TYPE_PILL[e.eventType] ?? "bg-gray-100 text-gray-600",
                      )}
                    >
                      {e.title}
                      {e.isGrade && e.percentage !== null && (
                        <span className="ml-1 font-medium">{Math.round(e.percentage)}%</span>
                      )}
                    </button>
                  ))}
                  {dayEvents.length > 2 && (
                    <button
                      onClick={() => setSelectedDate(dateStr)}
                      className="text-xs text-muted-foreground px-1 hover:text-foreground"
                    >
                      +{dayEvents.length - 2}개 더
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Month event list */}
        {monthEvents.length > 0 && (
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {month + 1}월 일정 목록
            </h3>
            <div className="space-y-1">
              {monthEvents.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedEvent(e)}
                  className="w-full text-left flex items-center justify-between text-sm py-2 border-b last:border-0 hover:bg-muted/30 rounded px-1 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-muted-foreground text-xs w-20 shrink-0">{e.date}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-xs shrink-0",
                        EVENT_TYPE_PILL[e.eventType] ?? "bg-gray-100 text-gray-600",
                      )}
                    >
                      {EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}
                    </span>
                    <span
                      className={cn(
                        "font-medium truncate",
                        e.isCompleted && !e.isGrade ? "line-through text-muted-foreground" : "",
                      )}
                    >
                      {e.title}
                    </span>
                  </div>
                  <div className="shrink-0 ml-2">
                    {e.isGrade && e.percentage !== null ? (
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
                    ) : !e.isGrade ? (
                      <span
                        className={cn(
                          "text-xs",
                          e.isCompleted ? "text-green-600 font-medium" : "text-muted-foreground",
                        )}
                      >
                        {e.isCompleted ? "완료" : "예정"}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(EVENT_TYPE_LABEL).map(([type, label]) => (
            <span
              key={type}
              className={cn("text-xs px-2 py-0.5 rounded", EVENT_TYPE_PILL[type])}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {selectedDate !== null && (
        <AddScheduleDialog
          date={selectedDate}
          subjects={subjects}
          onClose={() => setSelectedDate(null)}
        />
      )}
      {selectedEvent !== null && (
        <EventDetailDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}
