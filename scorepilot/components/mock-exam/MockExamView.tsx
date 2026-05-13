"use client";

import { useState, useTransition, useActionState, startTransition, useEffect } from "react";
import { upsertMockExamRecord, deleteMockExamRecord } from "@/lib/actions/mock-exam";
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
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

function GradeDonut({ grade, subject }: { grade: number | null; subject: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const fraction = grade != null ? Math.max(0, Math.min(1, (10 - grade) / 9)) : 0;
  const dashArray = `${fraction * circ} ${circ}`;
  const color =
    grade == null ? "#e5e7eb"
    : grade <= 2 ? "#16a34a"
    : grade <= 4 ? "#2563eb"
    : grade <= 6 ? "#ca8a04"
    : grade <= 8 ? "#ea580c"
    : "#dc2626";

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
          {grade != null ? grade : "-"}
        </text>
      </svg>
      <span className="text-xs font-medium text-muted-foreground">{subject}</span>
      {grade != null && <span className="text-xs font-bold" style={{ color }}>{grade}등급</span>}
    </div>
  );
}

function RecordEditDialog({
  record,
  examYear,
  examMonth,
  onClose,
}: {
  record: MockExamRecord | null;
  examYear: number;
  examMonth: number;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(upsertMockExamRecord, null);
  const [subject, setSubject] = useState(record?.subject ?? SUBJECTS[0]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (state?.success) { setOpen(false); onClose(); }
  }, [state, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{record ? "성적 수정" : "성적 입력"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }}
          className="space-y-4 mt-2"
        >
          <input type="hidden" name="exam_year" value={examYear} />
          <input type="hidden" name="exam_month" value={examMonth} />
          <div className="space-y-2">
            <Label>과목</Label>
            <select
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            >
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>원점수</Label>
              <Input name="raw_score" type="number" min="0" max="100" defaultValue={record?.raw_score ?? ""} placeholder="0–100" />
            </div>
            <div className="space-y-2">
              <Label>목표점수</Label>
              <Input name="target_score" type="number" min="0" max="100" defaultValue={record?.target_score ?? ""} placeholder="0–100" />
            </div>
            <div className="space-y-2">
              <Label>백분위</Label>
              <Input name="percentile" type="number" min="0" max="100" step="0.01" defaultValue={record?.percentile ?? ""} placeholder="0–100" />
            </div>
            <div className="space-y-2">
              <Label>등급</Label>
              <Input name="grade" type="number" min="1" max="9" defaultValue={record?.grade ?? ""} placeholder="1–9" />
            </div>
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

export default function MockExamView({ records }: { records: MockExamRecord[] }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(MONTHS.find((m) => m <= now.getMonth() + 1) ?? MONTHS[0]);
  const [trendSubject, setTrendSubject] = useState(SUBJECTS[0]);
  const [editTarget, setEditTarget] = useState<{ record: MockExamRecord | null } | null>(null);
  const [isPending, startTrans] = useTransition();

  const filtered = records.filter(
    (r) => r.exam_year === selectedYear && r.exam_month === selectedMonth
  );

  const recordMap = new Map(filtered.map((r) => [r.subject, r]));
  const scoredRecords = filtered.filter((r) => r.grade != null || r.raw_score != null || r.percentile != null);
  const avgGrade =
    scoredRecords.filter((r) => r.grade != null).length > 0
      ? Math.round(
          (scoredRecords
            .filter((r): r is MockExamRecord & { grade: number } => r.grade != null)
            .reduce((sum, r) => sum + r.grade, 0) /
            scoredRecords.filter((r) => r.grade != null).length) *
            10,
        ) / 10
      : null;
  const bestRecord = scoredRecords
    .filter((r) => r.grade != null)
    .sort((a, b) => (a.grade ?? 10) - (b.grade ?? 10))[0];
  const targetGapRecords = scoredRecords.filter((r) => r.raw_score != null && r.target_score != null);
  const avgTargetGap =
    targetGapRecords.length > 0
      ? Math.round(
          (targetGapRecords.reduce((sum, r) => sum + ((r.raw_score ?? 0) - (r.target_score ?? 0)), 0) /
            targetGapRecords.length) *
            10,
        ) / 10
      : null;
  const trendData = records
    .filter((r) => r.subject === trendSubject)
    .sort((a, b) => a.exam_year * 100 + a.exam_month - (b.exam_year * 100 + b.exam_month))
    .map((r) => ({
      label: `${String(r.exam_year).slice(2)}.${r.exam_month}`,
      rawScore: r.raw_score,
      percentile: r.percentile,
      grade: r.grade,
    }));
  const latestTrend = trendData[trendData.length - 1];
  const previousTrend = trendData[trendData.length - 2];
  const gradeDelta =
    latestTrend?.grade != null && previousTrend?.grade != null
      ? previousTrend.grade - latestTrend.grade
      : null;

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
        <Button
          size="sm"
          onClick={() => setEditTarget({ record: null })}
        >
          + 성적 입력
        </Button>
      </div>

      {/* 등급 도넛 차트 */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-5">
          {selectedYear}년 {selectedMonth}월 모의고사 — 과목별 등급
        </h2>
        <div className="flex items-center justify-around flex-wrap gap-4">
          {SUBJECTS.filter((s) => s !== "제2외국어").map((subject) => (
            <GradeDonut
              key={subject}
              subject={subject}
              grade={recordMap.get(subject)?.grade ?? null}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs text-muted-foreground mb-1">평균 등급</p>
          <p className="text-2xl font-bold">{avgGrade != null ? `${avgGrade}등급` : "-"}</p>
          <p className="text-xs text-muted-foreground mt-2">{selectedYear}년 {selectedMonth}월 기준</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs text-muted-foreground mb-1">가장 좋은 과목</p>
          <p className="text-2xl font-bold">{bestRecord ? bestRecord.subject : "-"}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {bestRecord?.grade != null ? `${bestRecord.grade}등급` : "성적을 입력하면 표시됩니다"}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs text-muted-foreground mb-1">목표 대비 평균</p>
          <p className={`text-2xl font-bold ${avgTargetGap != null && avgTargetGap >= 0 ? "text-green-600" : "text-yellow-600"}`}>
            {avgTargetGap == null ? "-" : avgTargetGap > 0 ? `+${avgTargetGap}점` : avgTargetGap === 0 ? "목표 달성" : `${avgTargetGap}점`}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {avgTargetGap == null
              ? "목표점수를 입력하면 표시됩니다"
              : avgTargetGap >= 0
                ? "목표를 넘긴 과목이 있습니다"
                : `평균 ${Math.abs(avgTargetGap)}점 보강 필요`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">모의고사 추이</h2>
            <p className="text-xs text-muted-foreground mt-1">
              등급은 숫자가 낮을수록 좋은 성적입니다.
            </p>
          </div>
          <select
            value={trendSubject}
            onChange={(e) => setTrendSubject(e.target.value)}
            className={selectClass}
          >
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 12 }} width={40} />
              <YAxis yAxisId="grade" orientation="right" domain={[1, 9]} tick={{ fontSize: 12 }} width={36} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line yAxisId="score" type="monotone" dataKey="rawScore" name="원점수" stroke="#2563eb" strokeWidth={2} connectNulls />
              <Line yAxisId="score" type="monotone" dataKey="percentile" name="백분위" stroke="#16a34a" strokeWidth={2} connectNulls />
              <Line yAxisId="grade" type="monotone" dataKey="grade" name="등급" stroke="#d97706" strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {gradeDelta == null
            ? `${trendSubject} 기록이 더 쌓이면 최근 등급 변화를 보여드립니다.`
            : gradeDelta > 0
              ? `${trendSubject} 등급이 직전 시험보다 ${gradeDelta}등급 좋아졌습니다.`
              : gradeDelta < 0
                ? `${trendSubject} 등급이 직전 시험보다 ${Math.abs(gradeDelta)}등급 내려갔습니다.`
                : `${trendSubject} 등급이 직전 시험과 같습니다.`}
        </div>
      </div>

      {/* 성적 테이블 */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{selectedYear}년 {selectedMonth}월 성적 상세</h2>
        </div>
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            이 시험에 등록된 성적이 없습니다.{" "}
            <button
              onClick={() => setEditTarget({ record: null })}
              className="text-primary underline"
            >
              성적 입력하기
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="pb-2 font-medium">과목</th>
                <th className="pb-2 font-medium text-right">원점수</th>
                <th className="pb-2 font-medium text-right">백분위</th>
                <th className="pb-2 font-medium text-right">등급</th>
                <th className="pb-2 font-medium text-right">목표점수</th>
                <th className="pb-2 font-medium text-right" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2.5 font-medium">{r.subject}</td>
                  <td className="py-2.5 text-right">{r.raw_score ?? "-"}</td>
                  <td className="py-2.5 text-right">{r.percentile != null ? `${r.percentile}%` : "-"}</td>
                  <td className={`py-2.5 text-right font-semibold ${r.grade != null ? (GRADE_COLOR[r.grade] ?? "") : "text-muted-foreground"}`}>
                    {r.grade != null ? `${r.grade}등급` : "-"}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {r.target_score != null ? (
                      <span className={r.raw_score != null && r.raw_score >= r.target_score ? "text-green-600" : "text-yellow-600"}>
                        {r.target_score}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget({ record: r })}>
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        className="text-red-500 hover:text-red-600"
                        onClick={() => startTrans(() => { void deleteMockExamRecord(r.id); })}
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editTarget && (
        <RecordEditDialog
          record={editTarget.record}
          examYear={selectedYear}
          examMonth={selectedMonth}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
