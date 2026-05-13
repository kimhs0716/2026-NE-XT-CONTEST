import { createClient } from "@/lib/supabase/server";
import { formatSemester, type SemesterType } from "@/lib/constants/grades";
import GradesHomeView, {
  type GradeSubjectCard,
  type SemesterOption,
} from "@/components/grades/GradesHomeView";

type ExamRow = {
  id: string;
  exam_type: string;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { score: number; max_score: number; percentage: number; memo: string | null }[];
};

type SubjectRow = {
  name: string;
  semester_id: string;
  category: string | null;
};

type SemesterRow = {
  id: string;
  year: number;
  semester_type: string;
};

type GradePoint = {
  name: string;
  semesterKey: string;
  percentage: number;
};

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>;
}) {
  const { semester: initialSemesterKey } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rows }, { data: subjectRows }, { data: semesterRows }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        id,
        exam_type,
        semesters!exam_semester ( year, semester_type ),
        subjects ( name ),
        grade_records ( score, max_score, percentage, memo )
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subjects")
      .select("name, semester_id, category")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("semesters")
      .select("id, year, semester_type")
      .eq("user_id", user!.id)
      .order("year", { ascending: false })
      .order("semester_type", { ascending: false }),
  ]);

  const rawSemesters = (semesterRows as SemesterRow[] ?? []);
  const currentYear = new Date().getFullYear();
  const semesterMap = new Map<string, SemesterOption>();

  for (const semester of rawSemesters) {
    const type = semester.semester_type as SemesterType;
    semesterMap.set(semester.id, {
      key: `${semester.year}-${type}`,
      label: formatSemester(semester.year, type),
      year: semester.year,
      type,
      order: semester.year * 10 + (type === "semester_2" ? 2 : 1),
    });
  }

  for (const type of ["semester_2", "semester_1"] as SemesterType[]) {
    const key = `${currentYear}-${type}`;
    if (![...semesterMap.values()].some((semester) => semester.key === key)) {
      semesterMap.set(key, {
        key,
        label: formatSemester(currentYear, type),
        year: currentYear,
        type,
        order: currentYear * 10 + (type === "semester_2" ? 2 : 1),
      });
    }
  }

  const semesters = [...semesterMap.values()].sort((a, b) => b.order - a.order);
  const gradePoints: GradePoint[] = (rows as ExamRow[] ?? []).flatMap((r) => {
    const grade = r.grade_records[0];
    if (!grade) return [];
    const subjectName = Array.isArray(r.subjects)
      ? r.subjects[0]?.name ?? ""
      : r.subjects?.name ?? "";
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    const semesterType = sem.semester_type as SemesterType;
    return [{
      name: subjectName,
      semesterKey: `${sem.year}-${semesterType}`,
      percentage: grade.percentage,
    }];
  });

  const subjectMap = new Map<string, GradeSubjectCard>();
  for (const subject of (subjectRows as SubjectRow[] ?? [])) {
    const semester = semesterMap.get(subject.semester_id);
    if (!semester) continue;
    const key = `${semester.key}:${subject.name}`;
    subjectMap.set(key, {
      name: subject.name,
      category: subject.category,
      semesterKey: semester.key,
      avg: null,
      count: 0,
    });
  }

  for (const grade of gradePoints) {
    const key = `${grade.semesterKey}:${grade.name}`;
    if (!subjectMap.has(key)) {
      subjectMap.set(key, {
        name: grade.name,
        category: null,
        semesterKey: grade.semesterKey,
        avg: null,
        count: 0,
      });
    }
  }

  for (const subject of subjectMap.values()) {
    const values = gradePoints
      .filter((grade) => grade.semesterKey === subject.semesterKey && grade.name === subject.name)
      .map((grade) => grade.percentage);
    subject.count = values.length;
    subject.avg = values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;
  }

  const subjects = [...subjectMap.values()];

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* 상단 */}
      <div>
        <div>
          <h1 className="text-2xl font-bold">내신</h1>
          <p className="text-muted-foreground text-sm mt-1">
            과목별 시험 성적을 기록하고 관리하세요
          </p>
        </div>
      </div>

      <GradesHomeView
        semesters={semesters}
        subjects={subjects}
        initialSemesterKey={initialSemesterKey}
      />
    </div>
  );
}
