import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatSemester, type ExamType, type SemesterType } from "@/lib/constants/grades";
import GradeForm from "@/components/grades/GradeForm";

type ExamRow = {
  id: string;
  exam_type: string;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { score: number; max_score: number; percentage: number; memo: string | null }[];
};

type SubjectSummary = {
  name: string;
  avg: number;
  count: number;
  latestSemester: string;
};

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows }, { data: subjectRows }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id,
        exam_type,
        semesters!exam_semester ( year, semester_type ),
        subjects ( name ),
        grade_records ( score, max_score, percentage, memo )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subjects")
      .select("name")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  const subjectNames = [...new Set((subjectRows ?? []).map((s) => s.name))];

  const grades = (rows as ExamRow[] ?? []).flatMap((r) => {
    const grade = r.grade_records[0];
    if (!grade) return [];
    const subjectName = Array.isArray(r.subjects)
      ? r.subjects[0]?.name ?? ""
      : r.subjects?.name ?? "";
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    return [{
      examId: r.id,
      subject: subjectName,
      examType: r.exam_type as ExamType,
      score: grade.score,
      maxScore: grade.max_score,
      percentage: grade.percentage,
      semesterYear: sem.year,
      semesterType: sem.semester_type as SemesterType,
      memo: grade.memo,
    }];
  });

  /* 과목별 요약 */
  const subjectMap = new Map<string, { percentages: number[]; semOrders: number[] }>();
  for (const g of grades) {
    if (!subjectMap.has(g.subject)) subjectMap.set(g.subject, { percentages: [], semOrders: [] });
    const entry = subjectMap.get(g.subject)!;
    entry.percentages.push(g.percentage);
    entry.semOrders.push(g.semesterYear * 10 + (g.semesterType === "semester_2" ? 2 : 1));
  }

  const subjectSummaries: SubjectSummary[] = [...subjectMap.entries()].map(([name, { percentages, semOrders }]) => {
    const avg = Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10;
    const maxSemOrder = Math.max(...semOrders);
    const year = Math.floor(maxSemOrder / 10);
    const semType: SemesterType = maxSemOrder % 10 === 2 ? "semester_2" : "semester_1";
    return { name, avg, count: percentages.length, latestSemester: formatSemester(year, semType) };
  }).sort((a, b) => a.name.localeCompare(b.name, "ko"));

  /* 학기 목록 */
  const semesterSet = new Set(
    grades.map((g) => `${g.semesterYear}-${g.semesterType}`)
  );
  const semesters = [...semesterSet]
    .map((s) => {
      const [year, type] = s.split("-");
      return {
        key: s,
        label: formatSemester(parseInt(year, 10), type as SemesterType),
        order: parseInt(year, 10) * 10 + (type === "semester_2" ? 2 : 1),
      };
    })
    .sort((a, b) => b.order - a.order);

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내신</h1>
          <p className="text-muted-foreground text-sm mt-1">
            과목별 시험 성적을 기록하고 관리하세요
          </p>
        </div>
        <GradeForm subjects={subjectNames} />
      </div>

      {subjectSummaries.length === 0 ? (
        <div className="rounded-2xl border bg-white p-16 text-center text-muted-foreground text-sm">
          <p>아직 등록된 성적이 없습니다.</p>
          <p className="mt-2 text-xs">오른쪽 상단 버튼으로 첫 성적을 추가하세요.</p>
        </div>
      ) : (
        <>
          {/* 학기별 요약 정보 */}
          {semesters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">등록된 학기:</span>
              {semesters.map((s) => (
                <span
                  key={s.key}
                  className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}

          {/* 과목 카드 그리드 */}
          <div className="grid grid-cols-4 gap-4">
            {subjectSummaries.map((s) => {
              const color =
                s.avg >= 80
                  ? "text-green-600"
                  : s.avg >= 60
                  ? "text-yellow-600"
                  : "text-red-500";
              return (
                <Link
                  key={s.name}
                  href={`/grades/${encodeURIComponent(s.name)}`}
                  className="rounded-2xl border bg-white p-5 flex flex-col gap-3 hover:shadow-md transition-shadow no-underline text-foreground"
                >
                  <div>
                    <p className="text-base font-bold">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.latestSemester}</p>
                  </div>
                  <div>
                    <span className={`text-2xl font-bold ${color}`}>{s.avg}%</span>
                    <span className="text-xs text-muted-foreground ml-1">평균 ({s.count}회)</span>
                  </div>
                  <div className="mt-auto inline-flex items-center justify-center rounded-lg bg-secondary/20 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                    → 홈 바로가기
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
