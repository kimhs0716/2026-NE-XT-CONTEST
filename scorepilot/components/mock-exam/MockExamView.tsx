"use client";

import { useState, useTransition, useActionState, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertMockExamRecord, deleteMockExamRecord } from "@/lib/actions/mock-exam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calcMockExamRelativeGrade,
  calcMockExamEnglishGrade,
  calcMockExamHistoryGrade,
  MOCK_RELATIVE_SUBJECTS,
  MOCK_HISTORY_SUBJECTS,
} from "@/lib/constants/grades";

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

// 탐구 카테고리: 세부 과목명을 별도 입력받는 카테고리
const TANGU_CATEGORIES = ["탐구1", "탐구2"];

// 드롭다운에 표시되는 과목 카테고리 목록
const SUBJECT_CATEGORIES = ["국어", "수학", "영어", "한국사", "탐구1", "탐구2", "제2외국어"];
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

const MAX_SCORE_BY_CATEGORY: Record<string, number> = {
  "한국사": 50,
  "탐구1": 50,
  "탐구2": 50,
  "제2외국어": 50,
};

function getMaxScore(category: string): number {
  return MAX_SCORE_BY_CATEGORY[category] ?? 100;
}

function rawScoreColor(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return "#16a34a";
  if (pct >= 60) return "#2563eb";
  if (pct >= 40) return "#ca8a04";
  return "#dc2626";
}

/** "탐구1(생명과학I)" → "탐구1" */
function getSubjectCategory(subject: string): string {
  for (const cat of TANGU_CATEGORIES) {
    if (subject === cat || subject.startsWith(`${cat}(`)) return cat;
  }
  return subject;
}

/** "탐구1(생명과학I)" → "생명과학I", "탐구1" → "" */
function getSubjectDetail(subject: string): string {
  const match = subject.match(/^탐구[12]\((.+)\)$/);
  return match ? match[1] : "";
}

/** 카테고리 + 세부명 → 저장할 과목 문자열 */
function buildSubjectKey(category: string, detail: string): string {
  const trimmed = detail.trim();
  if (TANGU_CATEGORIES.includes(category) && trimmed) {
    return `${category}(${trimmed})`;
  }
  return category;
}

/** 화면 표시용 과목명: "탐구1(생명과학I)" → "생명과학I", 나머지 → 그대로 */
function getDisplayName(subject: string): string {
  const detail = getSubjectDetail(subject);
  return detail || subject;
}

function autoCalcGrade(category: string, rawScore: string, percentile: string): number | null {
  const raw = rawScore ? parseFloat(rawScore) : null;
  const pct = percentile ? parseFloat(percentile) : null;

  if (MOCK_RELATIVE_SUBJECTS.includes(category) && pct != null && !isNaN(pct)) {
    return calcMockExamRelativeGrade(pct);
  }
  if (category === "영어" && raw != null && !isNaN(raw)) {
    return calcMockExamEnglishGrade(raw);
  }
  if (MOCK_HISTORY_SUBJECTS.includes(category) && raw != null && !isNaN(raw)) {
    return calcMockExamHistoryGrade(raw);
  }
  return null;
}

function GradeDonut({ grade, label }: { grade: number | null; label: string }) {
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
      <span className="text-xs font-medium text-muted-foreground text-center leading-tight max-w-[72px] break-words">
        {label}
      </span>
      {grade != null && <span className="text-xs font-bold" style={{ color }}>{grade}등급</span>}
    </div>
  );
}

function MockExamTableRow({
  record,
  category,
  examYear,
  examMonth,
  isEditing,
  onEdit,
  onCancel,
  onSaved,
  onDelete,
  deletePending,
  maxScore,
}: {
  record: MockExamRecord | null;
  category: string;
  examYear: number;
  examMonth: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete: () => void;
  deletePending: boolean;
  maxScore: number;
}) {
  const [state, action, pending] = useActionState(upsertMockExamRecord, null);

  // 탐구 세부 과목명
  const [tangDetail, setTangDetail] = useState(
    record ? getSubjectDetail(record.subject) : ""
  );

  const [rawScore, setRawScore] = useState(record?.raw_score != null ? String(record.raw_score) : "");
  const [percentile, setPercentile] = useState(record?.percentile != null ? String(record.percentile) : "");
  const [grade, setGrade] = useState(record?.grade != null ? String(record.grade) : "");

  const isTangu = TANGU_CATEGORIES.includes(category);
  const fullSubject = buildSubjectKey(category, tangDetail);
  const originalSubject = record?.subject ?? "";

  // 과목/점수/백분위 변경 시 등급 자동 계산
  useEffect(() => {
    const calc = autoCalcGrade(category, rawScore, percentile);
    if (calc !== null) setGrade(String(calc));
  }, [category, rawScore, percentile]);

  useEffect(() => {
    if (state?.success) onSaved();
  }, [state, onSaved]);

  const isRelative = MOCK_RELATIVE_SUBJECTS.includes(category);
  const isEnglish = category === "영어";
  const isHistory = MOCK_HISTORY_SUBJECTS.includes(category);

  let gradeHint = "";
  if (isRelative) gradeHint = "백분위 입력 시 자동 계산";
  else if (isEnglish) gradeHint = "원점수 기준: 90/80/70/60/50/40/30/20";
  else if (isHistory) gradeHint = "원점수 기준: 40/35/30/25/20/15/10/5";

  if (!isEditing) {
    const label = record && isTangu ? getDisplayName(record.subject) : category;

    return (
      <tr className="border-b last:border-0">
        <td className="py-2.5 font-medium">
          {label}
          {isTangu && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({category})
            </span>
          )}
        </td>
        <td
          className="py-2.5 text-right font-medium"
          style={record?.raw_score != null ? { color: rawScoreColor(record.raw_score, maxScore) } : undefined}
        >
          {record?.raw_score ?? "-"}
        </td>
        <td className="py-2.5 text-right">{record?.percentile != null ? `${record.percentile}%` : "-"}</td>
        <td className={`py-2.5 text-right font-semibold ${record?.grade != null ? (GRADE_COLOR[record.grade] ?? "") : "text-muted-foreground"}`}>
          {record?.grade != null ? `${record.grade}등급` : "-"}
        </td>
        <td className="py-2.5 text-right text-muted-foreground">
          {record?.target_score != null ? (
            <span className={record.raw_score != null && record.raw_score >= record.target_score ? "text-green-600" : "text-yellow-600"}>
              {record.target_score}
            </span>
          ) : "-"}
        </td>
        <td className="py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              {record ? "성적 수정" : "성적 입력"}
            </Button>
            {record && (
              <Button
                variant="ghost"
                size="sm"
                disabled={deletePending}
                className="text-red-500 hover:text-red-600"
                onClick={onDelete}
              >
                삭제
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0 bg-muted/20 align-top">
      <td className="py-2.5">
        <form
          id={`mock-exam-form-${category}`}
          onSubmit={(e) => { e.preventDefault(); startTransition(() => action(new FormData(e.currentTarget))); }}
        >
          <input type="hidden" name="exam_year" value={examYear} />
          <input type="hidden" name="exam_month" value={examMonth} />
          <input type="hidden" name="subject" value={fullSubject} />
          <input type="hidden" name="original_subject" value={originalSubject} />
          <input type="hidden" name="grade" value={grade} />
          <div className="space-y-1">
            <Label className="text-xs">{category}</Label>
            {isTangu ? (
              <Input
                placeholder="세부 과목명"
                value={tangDetail}
                onChange={(e) => setTangDetail(e.target.value)}
              />
            ) : (
              <p className="h-8 rounded-lg border border-transparent px-2.5 py-1.5 text-sm font-medium">
                {category}
              </p>
            )}
            {state?.error && <p className="text-xs text-red-500">{state.error}</p>}
          </div>
        </form>
      </td>
      <td className="py-2.5 text-right">
        <Input
          form={`mock-exam-form-${category}`}
          name="raw_score"
          type="number"
          min="0"
          max={maxScore}
          value={rawScore}
          onChange={(e) => setRawScore(e.target.value)}
          placeholder={`0-${maxScore}`}
          className="ml-auto max-w-24 text-right"
        />
      </td>
      <td className="py-2.5 text-right">
        {isRelative ? (
          <Input
            form={`mock-exam-form-${category}`}
            name="percentile"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={percentile}
            onChange={(e) => setPercentile(e.target.value)}
            placeholder="0-100"
            className="ml-auto max-w-24 text-right"
          />
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </td>
      <td className="py-2.5 text-right">
        <div className="space-y-1">
          <Input
            type="number"
            min="1"
            max="9"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="1-9"
            className="ml-auto max-w-20 text-right"
          />
          {gradeHint && <p className="text-right text-[11px] text-muted-foreground">{gradeHint}</p>}
        </div>
      </td>
      <td className="py-2.5 text-right">
        <Input
          form={`mock-exam-form-${category}`}
          name="target_score"
          type="number"
          min="0"
          max={maxScore}
          defaultValue={record?.target_score ?? ""}
          placeholder={`0-${maxScore}`}
          className="ml-auto max-w-24 text-right"
        />
      </td>
      <td className="py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="submit"
            form={`mock-exam-form-${category}`}
            size="sm"
            disabled={pending}
          >
            {pending ? "저장 중..." : record ? "성적 수정" : "성적 입력"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            취소
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function MockExamView({ records }: { records: MockExamRecord[] }) {
  const router = useRouter();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(MONTHS.find((m) => m <= now.getMonth() + 1) ?? MONTHS[0]);
  const [trendCategory, setTrendCategory] = useState(SUBJECT_CATEGORIES[0]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [isPending, startTrans] = useTransition();

  useEffect(() => {
    setEditingCategory(null);
  }, [selectedYear, selectedMonth]);

  const filtered = records.filter(
    (r) => r.exam_year === selectedYear && r.exam_month === selectedMonth
  );

  // 카테고리 기준으로 레코드 맵 구성 (탐구1(생명과학I) → 탐구1 키로 저장)
  const recordByCategory = new Map<string, MockExamRecord>();
  for (const r of filtered) {
    recordByCategory.set(getSubjectCategory(r.subject), r);
  }

  const scoredRecords = filtered.filter((r) => r.grade != null || r.raw_score != null || r.percentile != null);
  const avgGrade =
    scoredRecords.filter((r) => r.grade != null).length > 0
      ? Math.round(
          (scoredRecords
            .filter((r): r is MockExamRecord & { grade: number } => r.grade != null)
            .reduce((sum, r) => sum + r.grade, 0) /
            scoredRecords.filter((r) => r.grade != null).length) * 10,
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
            targetGapRecords.length) * 10,
        ) / 10
      : null;

  const trendData = records
    .filter((r) => getSubjectCategory(r.subject) === trendCategory)
    .sort((a, b) => a.exam_year * 100 + a.exam_month - (b.exam_year * 100 + b.exam_month))
    .map((r) => ({
      label: `${String(r.exam_year).slice(2)}.${r.exam_month}`,
      grade: r.grade,
      rawScore: r.raw_score,
      percentile: r.percentile,
    }));

  const latestGrade = trendData.at(-1)?.grade ?? null;
  const prevGrade = trendData.at(-2)?.grade ?? null;
  const gradeDelta = latestGrade != null && prevGrade != null ? prevGrade - latestGrade : null;

  const yearOptions: number[] = [];
  const minYear = Math.min(...records.map((r) => r.exam_year), now.getFullYear() - 2);
  for (let y = now.getFullYear(); y >= minYear; y--) yearOptions.push(y);

  const selectClass = "h-9 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring";

  // 도넛 차트에 표시할 과목 (제2외국어 제외)
  const donutCategories = SUBJECT_CATEGORIES.filter((s) => s !== "제2외국어");

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
          onClick={() => {
            const firstEmptyCategory =
              SUBJECT_CATEGORIES.find((cat) => !recordByCategory.has(cat)) ?? SUBJECT_CATEGORIES[0];
            setEditingCategory(firstEmptyCategory);
          }}
        >
          성적 입력
        </Button>
      </div>

      {/* 등급 도넛 차트 */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="text-base font-semibold mb-5">
          {selectedYear}년 {selectedMonth}월 모의고사 — 과목별 등급
        </h2>
        <div className="flex items-center justify-around flex-wrap gap-4">
          {donutCategories.map((cat) => {
            const rec = recordByCategory.get(cat);
            // 탐구 카테고리는 세부 과목명이 있으면 그걸 표시
            const label = TANGU_CATEGORIES.includes(cat) && rec
              ? getDisplayName(rec.subject)
              : cat;
            return (
              <GradeDonut
                key={cat}
                label={label}
                grade={rec?.grade ?? null}
              />
            );
          })}
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
          <p className="text-2xl font-bold">
            {bestRecord ? getDisplayName(bestRecord.subject) : "-"}
          </p>
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

      {/* 추이 차트 */}
      <div className="rounded-xl border bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">모의고사 추이</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gradeDelta == null
                ? "기록이 더 쌓이면 등급 변화를 확인할 수 있습니다."
                : gradeDelta > 0
                  ? `직전 시험보다 ${gradeDelta}등급 올랐습니다.`
                  : gradeDelta < 0
                    ? `직전 시험보다 ${Math.abs(gradeDelta)}등급 내려갔습니다.`
                    : "직전 시험과 등급이 같습니다."}
            </p>
          </div>
          <select
            value={trendCategory}
            onChange={(e) => setTrendCategory(e.target.value)}
            className={selectClass}
          >
            {SUBJECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        {trendData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {trendCategory} 성적을 입력하면 추이가 표시됩니다.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
<CartesianGrid stroke="transparent" />
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                <ReferenceLine key={g} y={g} stroke="#e5e7eb" strokeWidth={1} />
              ))}
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                domain={[1, 9]}
                reversed
                ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
                tick={{ fontSize: 12 }}
                width={28}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(value, name) => {
                  if (name === "등급") return [`${value}등급`, name];
                  return [value, name];
                }}
              />
              <Line
                type="monotone"
                dataKey="grade"
                name="등급"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 5, fill: "#2563eb" }}
                activeDot={{ r: 7 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 성적 테이블 */}
      <div className="rounded-xl border bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{selectedYear}년 {selectedMonth}월 성적 상세</h2>
        </div>
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
            {SUBJECT_CATEGORIES.map((cat) => {
              const record = recordByCategory.get(cat) ?? null;
              return (
                <MockExamTableRow
                  key={`${cat}:${record?.id ?? "empty"}:${editingCategory === cat ? "editing" : "view"}`}
                  category={cat}
                  record={record}
                  maxScore={getMaxScore(cat)}
                  examYear={selectedYear}
                  examMonth={selectedMonth}
                  isEditing={editingCategory === cat}
                  onEdit={() => setEditingCategory(cat)}
                  onCancel={() => setEditingCategory(null)}
                  onSaved={() => {
                    setEditingCategory(null);
                    router.refresh();
                  }}
                  onDelete={() => {
                    if (!record) return;
                    startTrans(async () => {
                      await deleteMockExamRecord(record.id);
                      router.refresh();
                    });
                  }}
                  deletePending={isPending}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
