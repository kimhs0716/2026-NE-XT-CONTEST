"use client";

import { useTransition } from "react";
import { deleteGrade } from "@/lib/actions/grades";
import { examTypeLabels, type ExamType } from "@/lib/constants/grades";
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

export default function GradeTable({ grades }: { grades: GradeRow[] }) {
  const [isPending, startTransition] = useTransition();

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
            <TableCell className="font-medium">{g.subject}</TableCell>
            <TableCell>
              <Badge variant="secondary">
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
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => startTransition(() => { void deleteGrade(g.examId) })}
                className="text-red-500 hover:text-red-600"
              >
                삭제
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
