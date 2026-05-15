import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatSemester,
  getSubjectsBySchoolLevel,
  parseGradeSubjectName,
  type ExamType,
  type SemesterType,
} from "@/lib/constants/grades";
import GradeForm from "@/components/grades/GradeForm";
import { encodeSubjectSegment } from "@/lib/subject-route";

type ExamRow = {
  id: string;
  exam_type: string;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { score: number; max_score: number; percentage: number; memo: string | null }[];
};

type SubjectSummary = {
  name: string;
  category: string;
  detail: string;
  avg: number;
  count: number;
  latestSemester: string;
};

type CategoryGroup = {
  category: string;
  items: SubjectSummary[];
};

export default async function GradesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows }, { data: subjectRows }, { data: profile }] = await Promise.all([
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
    supabase
      .from("profiles")
      .select("school_level")
      .eq("id", user.id)
      .single(),
  ]);

  const schoolLevel = profile?.school_level as "middle" | "high" | null;
  const presetSubjects = getSubjectsBySchoolLevel(schoolLevel);
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

  const allPresetAndUser = [...new Set([...presetSubjects, ...subjectNames])];

  const subjectSummaries: SubjectSummary[] = [...subjectMap.entries()].map(([name, { percentages, semOrders }]) => {
    const avg = Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10;
    const maxSemOrder = Math.max(...semOrders);
    const year = Math.floor(maxSemOrder / 10);
    const semType: SemesterType = maxSemOrder % 10 === 2 ? "semester_2" : "semester_1";
    const { category, detail } = parseGradeSubjectName(name, schoolLevel, allPresetAndUser);
    return { name, category, detail, avg, count: percentages.length, latestSemester: formatSemester(year, semType) };
  });

  /* 분류별 정렬: presetSubjects 순서 → 같은 분류 내 세부 과목명 가나다 → 기타는 맨 뒤 */
  subjectSummaries.sort((a, b) => {
    const rankA = presetSubjects.indexOf(a.category);
    const rankB = presetSubjects.indexOf(b.category);
    if (rankA !== rankB) {
      if (rankA === -1) return 1;
      if (rankB === -1) return -1;
      return rankA - rankB;
    }
    return a.detail.localeCompare(b.detail, "ko");
  });

  /* 분류별 그룹화 */
  const categoryGroups: CategoryGroup[] = [];
  for (const s of subjectSummaries) {
    const last = categoryGroups[categoryGroups.length - 1];
    if (last && last.category === s.category) {
      last.items.push(s);
    } else {
      categoryGroups.push({ category: s.category, items: [s] });
    }
  }

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
        <GradeForm subjects={subjectNames} schoolLevel={schoolLevel} />
      </div>

      {categoryGroups.length === 0 ? (
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

          {/* 분류별 과목 카드 */}
          <div className="space-y-6">
            {categoryGroups.map((group) => {
              const showHeader =
                categoryGroups.length > 1 ||
                group.items.some((s) => s.detail !== "");
              return (
                <div key={group.category}>
                  {showHeader && (
                    <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                      {group.category}
                    </h2>
                  )}
                  <div className="grid grid-cols-4 gap-4">
                    {group.items.map((s) => {
                      const color =
                        s.avg >= 80
                          ? "text-green-600"
                          : s.avg >= 60
                          ? "text-yellow-600"
                          : "text-red-500";
                      const displayName = s.detail || s.name;
                      return (
                        <Link
                          key={s.name}
                          href={`/grades/${encodeSubjectSegment(s.name)}`}
                          className="rounded-2xl border bg-white p-5 flex flex-col gap-3 hover:shadow-md transition-shadow no-underline text-foreground"
                        >
                          <div>
                            <p className="text-base font-bold">{displayName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{s.latestSemester}</p>
                          </div>
                          <div>
                            <span className={`text-2xl font-bold ${color}`}>{s.avg}점</span>
                            <span className="text-xs text-muted-foreground ml-1">평균 ({s.count}회)</span>
                          </div>
                          <div className="mt-auto inline-flex items-center justify-center rounded-lg bg-secondary/20 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                            → 홈 바로가기
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
