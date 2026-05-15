"use client";

import { useActionState, useState, useEffect, startTransition } from "react";
import { addGrade } from "@/lib/actions/grades";
import {
  examTypeLabels,
  examTypeGroups,
  getSubjectsBySchoolLevel,
  semesterTypeLabels,
  isGradeCategorySubject,
  buildGradeSubjectName,
  GRADE_CATEGORY_DETAIL_PLACEHOLDER,
  type SemesterType,
  type ExamType,
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

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function defaultSemesterType(): SemesterType {
  const m = new Date().getMonth() + 1;
  return m >= 3 && m <= 8 ? "semester_1" : "semester_2";
}

const WEIGHTED_EXAM_TYPES: ExamType[] = ["midterm", "assignment", "final"];

const INITIAL = {
  selectedCategory: "",
  categoryDetail: "",
  examType: "midterm" as ExamType,
  score: "",
  maxScore: "100",
  weight: "",
  memo: "",
};

export default function GradeForm({
  subjects: _subjects,
  schoolLevel,
}: {
  subjects: string[];
  schoolLevel?: "middle" | "high" | null;
}) {
  const [state, action, pending] = useActionState(addGrade, null);
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(INITIAL.selectedCategory);
  const [categoryDetail, setCategoryDetail] = useState(INITIAL.categoryDetail);
  const [examType, setExamType] = useState<ExamType>(INITIAL.examType);
  const [score, setScore] = useState(INITIAL.score);
  const [maxScore, setMaxScore] = useState(INITIAL.maxScore);
  const [weight, setWeight] = useState(INITIAL.weight);
  const [semesterYear, setSemesterYear] = useState(() => new Date().getFullYear());
  const [semesterType, setSemesterType] = useState<SemesterType>(defaultSemesterType);
  const [memo, setMemo] = useState(INITIAL.memo);

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setSelectedCategory(INITIAL.selectedCategory);
      setCategoryDetail(INITIAL.categoryDetail);
      setExamType(INITIAL.examType);
      setScore(INITIAL.score);
      setMaxScore(INITIAL.maxScore);
      setWeight(INITIAL.weight);
      setSemesterYear(new Date().getFullYear());
      setSemesterType(defaultSemesterType());
      setMemo(INITIAL.memo);
    }
  }, [state]);

  const presetSubjects = getSubjectsBySchoolLevel(schoolLevel);
  const showDetailInput =
    isGradeCategorySubject(selectedCategory, schoolLevel) || selectedCategory === "기타";
  const subjectName = buildGradeSubjectName(selectedCategory, categoryDetail, schoolLevel);
  const showWeight = WEIGHTED_EXAM_TYPES.includes(examType);
  const detailPlaceholder =
    GRADE_CATEGORY_DETAIL_PLACEHOLDER[selectedCategory] ?? "세부 과목명 입력";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger render={<Button>+ 성적 추가</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>성적 추가</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(() => action(new FormData(e.currentTarget)));
          }}
          className="space-y-4 mt-2"
        >
          <input type="hidden" name="subject_name" value={subjectName} />
          <div className="space-y-2">
            <Label>과목명<span className="text-red-500">*</span></Label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCategoryDetail("");
              }}
              className={selectClass}
            >
              <option value="">과목 선택</option>
              {presetSubjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="기타">기타</option>
            </select>
            {showDetailInput && (
              <Input
                placeholder={detailPlaceholder}
                value={categoryDetail}
                onChange={(e) => setCategoryDetail(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="exam_type">시험 종류<span className="text-red-500">*</span></Label>
            <select
              id="exam_type"
              name="exam_type"
              value={examType}
              onChange={(e) => setExamType(e.target.value as ExamType)}
              className={selectClass}
            >
              {examTypeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map((type) => (
                    <option key={type} value={type}>
                      {examTypeLabels[type]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="score">점수<span className="text-red-500">*</span></Label>
              <Input
                id="score"
                name="score"
                type="number"
                min="0"
                step="0.01"
                placeholder="85"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_score">만점</Label>
              <Input
                id="max_score"
                name="max_score"
                type="number"
                min="1"
                step="0.01"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </div>
          </div>
          {showWeight && (
            <div className="space-y-2">
              <Label htmlFor="weight">반영비 (%)</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="30"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                중간고사 + 수행평가 + 기말고사 반영비 합이 100이면 총점 기준으로 확인할 수 있습니다
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>학기<span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="semester_year"
                type="number"
                min="2000"
                max="2099"
                value={semesterYear}
                onChange={(e) => setSemesterYear(parseInt(e.target.value, 10))}
                required
              />
              <select
                name="semester_type"
                value={semesterType}
                onChange={(e) => setSemesterType(e.target.value as SemesterType)}
                className={selectClass}
              >
                {(Object.entries(semesterTypeLabels) as [SemesterType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">메모 (선택)</Label>
            <Input
              id="memo"
              name="memo"
              placeholder="범위: 1~3단원"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "저장 중..." : "저장"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
