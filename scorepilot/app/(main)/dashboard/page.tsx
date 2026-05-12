import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { examTypeLabels, formatSemester, type ExamType, type SemesterType } from "@/lib/constants/grades";
import { cn } from "@/lib/utils";

type ExamRow = {
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
  grade_records: { percentage: number }[];
};

function StatCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  color?: "green" | "yellow" | "red" | "default";
}) {
  const valueColor =
    color === "green"
      ? "text-green-600"
      : color === "yellow"
      ? "text-yellow-600"
      : color === "red"
      ? "text-red-500"
      : "text-foreground";
  return (
    <div className="rounded-xl border bg-white p-5 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-bold", valueColor)}>
        {value}
        {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("exams")
    .select(`
      exam_type,
      subjects ( name ),
      semesters!exam_semester ( year, semester_type ),
      grade_records ( percentage )
    `)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentSemType: SemesterType = currentMonth >= 3 && currentMonth <= 8 ? "semester_1" : "semester_2";

  const validRows = (rows as ExamRow[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    return [{
      examType: r.exam_type as ExamType,
      subject: name,
      percentage: Number(pct),
      semesterYear: sem.year,
      semesterType: sem.semester_type as SemesterType,
      semesterLabel: formatSemester(sem.year, sem.semester_type as SemesterType),
    }];
  });

  const totalExams = validRows.length;
  const overallAvg =
    totalExams > 0
      ? Math.round((validRows.reduce((a, r) => a + r.percentage, 0) / totalExams) * 10) / 10
      : 0;

  const subjectSet = new Set(validRows.map((r) => r.subject));
  const subjectCount = subjectSet.size;

  const currentSemCount = validRows.filter(
    (r) => r.semesterYear === currentYear && r.semesterType === currentSemType
  ).length;

  const recent = validRows.slice(0, 6);

  const subjectMap = new Map<string, number[]>();
  for (const r of validRows) {
    if (!subjectMap.has(r.subject)) subjectMap.set(r.subject, []);
    subjectMap.get(r.subject)!.push(r.percentage);
  }
  const subjectAvgs = [...subjectMap.entries()]
    .map(([subject, pcts]) => ({
      subject,
      avg: Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10,
      count: pcts.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  const weakSubjects = subjectAvgs.filter((s) => s.avg < 70);
  const strongSubjects = [...subjectAvgs].reverse().filter((s) => s.avg >= 80);

  const avgColor =
    overallAvg >= 80 ? "green" : overallAvg >= 60 ? "yellow" : overallAvg > 0 ? "red" : "default";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          성적 요약과 분석 결과를 한눈에 확인하세요
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="전체 시험" value={totalExams} unit="회" />
        <StatCard label="전체 평균" value={overallAvg} unit="%" color={avgColor} />
        <StatCard label="등록 과목" value={subjectCount} unit="개" />
        <StatCard label="이번 학기" value={currentSemCount} unit="회" />
      </div>

      {totalExams === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center space-y-3">
          <p className="text-muted-foreground">아직 등록된 성적이 없습니다.</p>
          <Link href="/grades" className="text-sm text-primary underline">
            성적 추가하러 가기 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">최근 성적</h2>
              <Link href="/grades" className="text-xs text-muted-foreground hover:text-foreground">
                전체 보기 →
              </Link>
            </div>
            <div className="space-y-1">
              {recent.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{r.subject}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {examTypeLabels[r.examType]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">{r.semesterLabel}</span>
                    <span
                      className={cn(
                        "font-semibold w-14 text-right",
                        r.percentage >= 80
                          ? "text-green-600"
                          : r.percentage >= 60
                          ? "text-yellow-600"
                          : "text-red-500",
                      )}
                    >
                      {r.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {weakSubjects.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-red-700">주의 과목</h2>
                  <Link href="/analytics" className="text-xs text-red-500 hover:text-red-700">
                    분석 보기 →
                  </Link>
                </div>
                {weakSubjects.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between text-sm">
                    <span className="text-red-800">{s.subject}</span>
                    <span className="text-red-600 font-semibold">{s.avg}%</span>
                  </div>
                ))}
              </div>
            )}

            {strongSubjects.length > 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-green-700">우수 과목</h2>
                  <Link href="/analytics" className="text-xs text-green-600 hover:text-green-800">
                    분석 보기 →
                  </Link>
                </div>
                {strongSubjects.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between text-sm">
                    <span className="text-green-800">{s.subject}</span>
                    <span className="text-green-600 font-semibold">{s.avg}%</span>
                  </div>
                ))}
              </div>
            )}

            {weakSubjects.length === 0 && strongSubjects.length === 0 && subjectAvgs.length > 0 && (
              <div className="rounded-xl border bg-white p-6 space-y-3">
                <h2 className="font-semibold">과목별 평균</h2>
                {subjectAvgs.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between text-sm">
                    <span>{s.subject}</span>
                    <span className="font-medium">{s.avg}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
