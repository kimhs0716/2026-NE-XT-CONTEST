"use client";

import { useState, useMemo, useActionState, useTransition, useEffect, startTransition } from "react";
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
import { addSchedule, updateSchedule, deleteSchedule, toggleScheduleComplete } from "@/lib/actions/calendar";
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

export type ScheduleEvent = {
  id: string;
  date: string;
  title: string;
  eventType: string;
  isCompleted: boolean;
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
    subjectMode === "select" ? selectedSubject : subjectMode === "custom" ? customSubject : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>일정 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }} className="space-y-4 mt-2">
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label htmlFor="sched-title">제목<span className="text-red-500">*</span></Label>
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
            <Label htmlFor="sched-date">날짜<span className="text-red-500">*</span></Label>
            <Input id="sched-date" name="start_date" type="date" defaultValue={date} required />
          </div>
          <div className="space-y-2">
            <Label>과목 (선택)</Label>
            <select
              value={subjectMode === "none" ? "" : subjectMode === "custom" ? "__custom__" : selectedSubject}
              onChange={(e) => {
                if (!e.target.value) setSubjectMode("none");
                else if (e.target.value === "__custom__") { setSubjectMode("custom"); setSelectedSubject(""); }
                else { setSubjectMode("select"); setSelectedSubject(e.target.value); }
              }}
              className={selectClass}
            >
              <option value="">과목 없음</option>
              {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
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

function EditScheduleDialog({
  event,
  subjects,
  onClose,
}: {
  event: ScheduleEvent;
  subjects: string[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateSchedule, null);

  const initSubjectMode = (): "none" | "select" | "custom" => {
    if (!event.subjectName) return "none";
    const opts = [...new Set([...commonSubjects, ...subjects])];
    return opts.includes(event.subjectName) ? "select" : "custom";
  };

  const [subjectMode, setSubjectMode] = useState<"none" | "select" | "custom">(initSubjectMode);
  const [selectedSubject, setSelectedSubject] = useState(
    initSubjectMode() === "select" ? (event.subjectName ?? "") : ""
  );
  const [customSubject, setCustomSubject] = useState(
    initSubjectMode() === "custom" ? (event.subjectName ?? "") : ""
  );

  useEffect(() => {
    if (state?.success) onClose();
  }, [state]);

  const subjectOptions = [...new Set([...commonSubjects, ...subjects])];
  const subjectName =
    subjectMode === "select" ? selectedSubject : subjectMode === "custom" ? customSubject : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>일정 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }} className="space-y-4 mt-2">
          <input type="hidden" name="schedule_id" value={event.id} />
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label htmlFor="edit-title">제목<span className="text-red-500">*</span></Label>
            <Input id="edit-title" name="title" defaultValue={event.title} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label>일정 종류</Label>
            <select name="event_type" defaultValue={event.eventType} className={selectClass}>
              {SCHEDULE_EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-date">날짜<span className="text-red-500">*</span></Label>
            <Input id="edit-date" name="start_date" type="date" defaultValue={event.date} required />
          </div>
          <div className="space-y-2">
            <Label>과목 (선택)</Label>
            <select
              value={subjectMode === "none" ? "" : subjectMode === "custom" ? "__custom__" : selectedSubject}
              onChange={(e) => {
                if (!e.target.value) setSubjectMode("none");
                else if (e.target.value === "__custom__") { setSubjectMode("custom"); setSelectedSubject(""); }
                else { setSubjectMode("select"); setSelectedSubject(e.target.value); }
              }}
              className={selectClass}
            >
              <option value="">과목 없음</option>
              {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
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
            <Label htmlFor="edit-desc">메모 (선택)</Label>
            <Input
              id="edit-desc"
              name="description"
              placeholder="범위, 준비사항 등"
              defaultValue={event.description ?? ""}
            />
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
  onEdit,
}: {
  event: ScheduleEvent;
  onClose: () => void;
  onEdit: () => void;
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">상태</span>
            <span className={event.isCompleted ? "text-green-600" : "text-muted-foreground"}>
              {event.isCompleted ? "완료" : "예정"}
            </span>
          </div>
          {event.description && (
            <div className="pt-2 border-t">
              <p className="text-muted-foreground text-xs">{event.description}</p>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-4 pt-4 border-t gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggle}
              disabled={pending}
              className={event.isCompleted ? "text-muted-foreground" : "text-green-600 border-green-200 hover:bg-green-50"}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {event.isCompleted ? "완료 취소" : "완료"}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit} disabled={pending}>수정</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>삭제</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarView({
  schedules,
  subjects,
}: {
  schedules: ScheduleEvent[];
  subjects: string[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [tooltip, setTooltip] = useState<{ event: ScheduleEvent; x: number; y: number } | null>(null);

  function handlePillEnter(e: React.MouseEvent<HTMLButtonElement>, ev: ScheduleEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ event: ev, x: rect.left, y: rect.bottom + 6 });
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of schedules) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [schedules]);

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

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthEvents = schedules
    .filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <div className="h-full grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] overflow-hidden">
        <section className="min-w-0 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 md:px-5">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="outline" size="icon" onClick={goToPrev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <span className="text-lg font-semibold ml-1 whitespace-nowrap">
                {year}년 {month + 1}월
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={goToToday}>오늘</Button>
              <Button size="sm" onClick={() => setSelectedDate(todayStr)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                일정 추가
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border bg-white flex flex-col">
            <div className="shrink-0 flex w-full border-b bg-muted/20">
              {WEEKDAYS.map((d, colIdx) => (
                <div
                  key={d}
                  style={{ width: `${100 / 7}%` }}
                  className={cn(
                    "flex-none border-r last:border-r-0 text-center py-2 text-xs font-medium",
                    colIdx === 0 ? "text-red-500" : colIdx === 6 ? "text-blue-500" : "text-muted-foreground",
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="flex flex-col flex-1 min-h-0">
            {weeks.map((week, rowIdx) => {
              const isLastRow = rowIdx === weeks.length - 1;
              return (
                <div key={rowIdx} className="flex w-full flex-1 min-h-0">
                  {week.map((day, colIdx) => {
                    const isLastCol = colIdx === 6;
                    const isSun = colIdx === 0;
                    const isSat = colIdx === 6;
                    const cellBorder = cn(!isLastRow && "border-b", !isLastCol && "border-r");

                    if (!day) {
                      return (
                        <div
                          key={colIdx}
                          style={{ width: `${100 / 7}%` }}
                          className={cn("flex-none bg-muted/10 overflow-hidden", cellBorder)}
                        />
                      );
                    }

                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayEvents = eventsByDate.get(dateStr) ?? [];
                    const isToday = dateStr === todayStr;

                    return (
                      <div
                        key={colIdx}
                        style={{ width: `${100 / 7}%` }}
                        className={cn("flex-none overflow-hidden p-1 bg-white group", cellBorder)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
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
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 2).map((e, j) => (
                            <button
                              key={j}
                              onClick={() => setSelectedEvent(e)}
                              onMouseEnter={(ev) => handlePillEnter(ev, e)}
                              onMouseLeave={() => setTooltip(null)}
                              className={cn(
                                "block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-4",
                                e.isCompleted ? "opacity-60 line-through" : "",
                                EVENT_TYPE_PILL[e.eventType] ?? "bg-gray-100 text-gray-600",
                              )}
                            >
                              {e.title}
                            </button>
                          ))}
                          {dayEvents.length > 2 && (
                            <button
                              onClick={() => setSelectedDate(dateStr)}
                              className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              +{dayEvents.length - 2}개 더
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </div>
        </section>

        <aside className="w-full xl:w-[340px] xl:min-w-[340px] xl:max-w-[340px] flex flex-col gap-4 overflow-hidden">
          <div className="rounded-2xl border bg-white p-4 space-y-3 flex flex-col flex-1 overflow-hidden">
            <h3 className="text-sm font-semibold text-muted-foreground shrink-0">
              {month + 1}월 일정 목록
            </h3>
            <div className="flex-1 space-y-1 overflow-y-auto pr-1 min-h-0">
              {monthEvents.length > 0 ? (
                monthEvents.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEvent(e)}
                    onMouseEnter={(ev) => handlePillEnter(ev, e)}
                    onMouseLeave={() => setTooltip(null)}
                    className="w-full rounded-lg border border-transparent px-2 py-2 text-left text-sm transition-colors hover:border-border hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground">{e.date}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[11px]",
                          EVENT_TYPE_PILL[e.eventType] ?? "bg-gray-100 text-gray-600",
                        )}
                      >
                        {EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate font-medium",
                          e.isCompleted ? "line-through text-muted-foreground" : "",
                        )}
                      >
                        {e.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {e.isCompleted ? "완료" : "예정"}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-1 py-3 text-sm text-muted-foreground">
                  이 달에는 일정이 없습니다.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 space-y-3 shrink-0">
            <h3 className="text-sm font-semibold text-muted-foreground">범례</h3>
            <div className="flex flex-wrap gap-2">
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
        </aside>
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
          onEdit={() => {
            setEditingEvent(selectedEvent);
            setSelectedEvent(null);
          }}
        />
      )}
      {editingEvent !== null && (
        <EditScheduleDialog
          event={editingEvent}
          subjects={subjects}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {tooltip && (
        <div
          style={{ top: tooltip.y, left: tooltip.x }}
          className="fixed z-[200] pointer-events-none max-w-[220px] rounded-lg border bg-white shadow-lg px-3 py-2.5 text-xs space-y-1.5"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("px-1.5 py-0.5 rounded font-medium", EVENT_TYPE_PILL[tooltip.event.eventType] ?? "bg-gray-100 text-gray-600")}>
              {EVENT_TYPE_LABEL[tooltip.event.eventType] ?? tooltip.event.eventType}
            </span>
            <span className={cn("text-xs ml-auto", tooltip.event.isCompleted ? "text-green-600 font-medium" : "text-muted-foreground")}>
              {tooltip.event.isCompleted ? "✓ 완료" : "예정"}
            </span>
          </div>
          <p className="font-semibold text-foreground leading-snug">{tooltip.event.title}</p>
          {tooltip.event.subjectName && (
            <p className="text-muted-foreground">{tooltip.event.subjectName}</p>
          )}
          {tooltip.event.description && (
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{tooltip.event.description}</p>
          )}
        </div>
      )}
    </>
  );
}
