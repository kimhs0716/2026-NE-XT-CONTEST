"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, startTransition } from "react";
import { addSemester, addSubject } from "@/lib/actions/grades";
import {
  inferSubjectCategory,
  semesterTypeLabels,
  subjectCategoryOptions,
  type SemesterType,
} from "@/lib/constants/grades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type SemesterOption = {
  key: string;
  label: string;
  year: number;
  type: SemesterType;
  order: number;
};

export type GradeSubjectCard = {
  name: string;
  category: string | null;
  semesterKey: string;
  avg: number | null;
  count: number;
};

const selectClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function AddSemesterDialog() {
  const [state, action, pending] = useActionState(addSemester, null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [type, setType] = useState<SemesterType>("semester_1");

  useEffect(() => {
    if (!state?.success) return;
    queueMicrotask(() => setOpen(false));
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">+ 학기 추가</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>학기 추가</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>연도</Label>
              <Input
                name="semester_year"
                type="number"
                min="2000"
                max="2099"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>학기</Label>
              <select
                name="semester_type"
                value={type}
                onChange={(e) => setType(e.target.value as SemesterType)}
                className={selectClass}
              >
                {(Object.entries(semesterTypeLabels) as [SemesterType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "추가 중..." : "추가"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddSubjectDialog({
  semester,
}: {
  semester: SemesterOption;
}) {
  const [state, action, pending] = useActionState(addSubject, null);
  const [open, setOpen] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!state?.success) return;
    queueMicrotask(() => {
      setOpen(false);
      setSubjectName("");
      setCategory("");
    });
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ 과목 추가</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>과목 추가 · {semester.label}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          <input type="hidden" name="semester_year" value={semester.year} />
          <input type="hidden" name="semester_type" value={semester.type} />
          <input type="hidden" name="subject_name" value={subjectName} />
          <input type="hidden" name="subject_category" value={category} />
          <div className="space-y-2">
            <Label>과목명</Label>
            <Input
              value={subjectName}
              onChange={(e) => {
                setSubjectName(e.target.value);
                setCategory((current) => current || inferSubjectCategory(e.target.value));
              }}
              placeholder="예: 공통수학1, 대수, 미적분1"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label>분류<span className="text-red-500">*</span></Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
              required
            >
              <option value="">분류 선택</option>
              {subjectCategoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "추가 중..." : "추가"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function GradesHomeView({
  semesters,
  subjects,
  initialSemesterKey,
}: {
  semesters: SemesterOption[];
  subjects: GradeSubjectCard[];
  initialSemesterKey?: string;
}) {
  const [selectedKey, setSelectedKey] = useState(
    semesters.some((semester) => semester.key === initialSemesterKey)
      ? initialSemesterKey!
      : semesters[0]?.key ?? "",
  );

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.key === selectedKey) ?? semesters[0],
    [selectedKey, semesters],
  );

  const visibleSubjects = useMemo(
    () => subjects
      .filter((subject) => subject.semesterKey === selectedSemester?.key)
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [subjects, selectedSemester?.key],
  );

  if (!selectedSemester) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center text-sm text-muted-foreground">
        학기를 추가하면 과목을 관리할 수 있습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className={`${selectClass} min-w-36 font-medium`}
            aria-label="학기 선택"
          >
            {semesters.map((semester) => (
              <option key={semester.key} value={semester.key}>{semester.label}</option>
            ))}
          </select>
          <div className="rounded-lg border px-3 py-1.5 text-sm font-semibold">
            {selectedSemester.label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddSemesterDialog />
          <AddSubjectDialog semester={selectedSemester} />
        </div>
      </div>

      {visibleSubjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-16 text-center text-sm text-muted-foreground">
          이 학기에 등록된 과목이 없습니다. 오른쪽 위에서 과목을 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {visibleSubjects.map((subject) => {
            const color =
              subject.avg == null
                ? "text-muted-foreground"
                : subject.avg >= 80
                  ? "text-green-600"
                  : subject.avg >= 60
                    ? "text-yellow-600"
                    : "text-red-500";
            return (
              <Link
                key={`${subject.semesterKey}-${subject.name}`}
                href={`/grades/${encodeURIComponent(subject.name)}?semester=${encodeURIComponent(subject.semesterKey)}`}
                className="rounded-2xl border bg-white p-6 min-h-[170px] flex flex-col items-center justify-center gap-4 text-center hover:shadow-md transition-shadow no-underline text-foreground"
              >
                <div>
                  <p className="text-2xl font-bold">{subject.name}</p>
                  {subject.category && (
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {subject.category}
                    </p>
                  )}
                  <p className={`mt-2 text-sm font-semibold ${color}`}>
                    {subject.avg == null ? "성적 없음" : `${subject.avg}% 평균 · ${subject.count}회`}
                  </p>
                </div>
                <div className="w-full rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900">
                  → 홈 바로가기
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
