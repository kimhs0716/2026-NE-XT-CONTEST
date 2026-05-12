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

function QuickLinkCard({
  href,
  title,
  description,
  accent,
}: {
  href: string;
  title: string;
  description: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border bg-white p-5 flex flex-col gap-2 hover:shadow-md transition-shadow",
        accent,
      )}
    >
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <span className="text-xs text-primary mt-auto self-end">바로가기 →</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rows }, { data: profileData }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        exam_type,
        subjects ( name ),
        semesters!exam_semester ( year, semester_type ),
        grade_records ( percentage )
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("school_level, name")
      .eq("id", user!.id)
      .single(),
  ]);

  const schoolLevel = (profileData?.school_level as "middle" | "high") ?? null;
  const userName = profileData?.name ?? null;

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

  const recent = validRows.slice(0, 5);

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
        <h1 className="text-2xl font-bold">
          {userName ? `${userName}님의 대시보드` : "대시보드"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {schoolLevel === "high" ? "고등학생 성적 관리" : "중학생 성적 관리"} — 성적 요약을 한눈에 확인하세요
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="전체 시험" value={totalExams} unit="회" />
        <StatCard label="전체 평균" value={overallAvg} unit="%" color={avgColor} />
        <StatCard label="등록 과목" value={subjectCount} unit="개" />
        <StatCard label="이번 학기" value={currentSemCount} unit="회" />
      </div>

      {totalExams === 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-12 text-center space-y-3">
            <p className="text-muted-foreground">아직 등록된 성적이 없습니다.</p>
            <Link href="/grades" className="text-sm text-primary underline">
              성적 추가하러 가기 →
            </Link>
          </div>

          <div className={cn("grid gap-4", schoolLevel === "high" ? "grid-cols-3" : "grid-cols-3")}>
            <QuickLinkCard
              href="/grades"
              title="내신 관리"
              description="시험 성적과 수행평가를 기록하고 학기별로 관리하세요"
            />
            {schoolLevel === "high" && (
              <QuickLinkCard
                href="/mock-exam"
                title="모의고사"
                description="수능 모의고사 성적을 과목별로 기록하고 추이를 확인하세요"
                accent="border-violet-200"
              />
            )}
            <QuickLinkCard
              href="/analytics"
              title="성적 분석"
              description="과목별 추이와 AI 예측을 확인하세요"
            />
            <QuickLinkCard
              href="/strategy"
              title="맞춤전략"
              description="취약점을 분석하고 나만의 학습 전략을 세우세요"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn("grid gap-6", schoolLevel === "high" ? "grid-cols-2" : "grid-cols-2")}>
            {/* 내신 최근 성적 */}
            <div className="rounded-xl border bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">최근 내신 성적</h2>
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

            {/* 고등학생: 모의고사 quick card / 중학생: 과목별 현황 */}
            {schoolLevel === "high" ? (
              <Link
                href="/mock-exam"
                className="rounded-xl border border-violet-200 bg-violet-50 p-6 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-violet-800">모의고사</h2>
                  <span className="text-xs text-violet-500">바로가기 →</span>
                </div>
                <p className="text-sm text-violet-700">
                  수능 모의고사 성적을 과목별로 기록하고<br />원점수 · 백분위 · 등급을 추적하세요
                </p>
                <div className="mt-auto pt-2 border-t border-violet-200">
                  <p className="text-xs text-violet-500">국어 · 수학 · 영어 · 한국사 · 탐구 · 제2외국어</p>
                </div>
              </Link>
            ) : (
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
            )}
          </div>

          {/* 고등학생: 추가로 주의/우수 과목 표시 */}
          {schoolLevel === "high" && (weakSubjects.length > 0 || strongSubjects.length > 0) && (
            <div className="grid grid-cols-2 gap-6">
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
            </div>
          )}

          {/* 하단 퀵링크 */}
          <div className={cn("grid gap-4", schoolLevel === "high" ? "grid-cols-3" : "grid-cols-2")}>
            <QuickLinkCard
              href="/analytics"
              title="성적 분석"
              description="과목별 추이 그래프와 AI 성적 예측을 확인하세요"
            />
            <QuickLinkCard
              href="/strategy"
              title="맞춤전략"
              description="취약점과 우선순위를 분석해 학습 전략을 세우세요"
            />
            {schoolLevel === "high" && (
              <QuickLinkCard
                href="/calendar"
                title="캘린더"
                description="시험 일정과 학습 계획을 캘린더로 관리하세요"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
