"use client";

import { useTransition } from "react";
import { deleteGrade } from "@/lib/actions/grades";
import { examTypeLabels, type ExamType } from "@/lib/constants/grades";

const SUBJECT_COLORS = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706",
  "#9333ea", "#0891b2", "#db2777", "#65a30d",
];

const examTypeBadgeClass: Record<ExamType, string> = {
  midterm:    "bg-blue-100 text-blue-700 hover:bg-blue-100",
  final:      "bg-violet-100 text-violet-700 hover:bg-violet-100",
  mock_exam:  "bg-orange-100 text-orange-700 hover:bg-orange-100",
  assignment: "bg-green-100 text-green-700 hover:bg-green-100",
  other:      "bg-gray-100 text-gray-600 hover:bg-gray-100",
};
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GradeEditForm from "@/components/grades/GradeEditForm";

type GradeRow = {
  examId: string;
  subject: string;
  examType: ExamType;
  score: number;
  maxScore: number;
  percentage: number;
  date: string;
  memo: string | null;
};

export default function GradeTable({ grades, subjects }: { grades: GradeRow[]; subjects: string[] }) {
  const [isPending, startTransition] = useTransition();
  const uniqueSubjects = [...new Set(grades.map((g) => g.subject))];
  const subjectColor = (name: string) =>
    SUBJECT_COLORS[uniqueSubjects.indexOf(name) % SUBJECT_COLORS.length];

  if (grades.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        아직 등록된 성적이 없습니다.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>과목</TableHead>
          <TableHead>시험 종류</TableHead>
          <TableHead className="text-right">점수</TableHead>
          <TableHead className="text-right">백분율</TableHead>
          <TableHead>날짜</TableHead>
          <TableHead>메모</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {grades.map((g) => (
          <TableRow key={g.examId}>
            <TableCell className="font-medium">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: subjectColor(g.subject) }}
                />
                {g.subject}
              </span>
            </TableCell>
            <TableCell>
              <Badge className={examTypeBadgeClass[g.examType]}>
                {examTypeLabels[g.examType]}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {g.score} / {g.maxScore}
            </TableCell>
            <TableCell className="text-right">
              <span className={g.percentage >= 80 ? "text-green-600" : g.percentage >= 60 ? "text-yellow-600" : "text-red-500"}>
                {g.percentage.toFixed(1)}%
              </span>
            </TableCell>
            <TableCell>{g.date}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{g.memo ?? "-"}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <GradeEditForm grade={g} subjects={subjects} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => startTransition(() => { void deleteGrade(g.examId) })}
                  className="text-red-500 hover:text-red-600"
                >
                  삭제
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
