import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type SemesterType } from "@/lib/constants/grades";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";

type ExamRow = {
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
  semesters: { year: number; semester_type: string } | { year: number; semester_type: string }[] | null;
  grade_records: { percentage: number }[];
};

type ScheduleRow = {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  subjects: { name: string } | { name: string }[] | null;
};

type StudyTaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  subjects: { name: string } | { name: string }[] | null;
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  exam: "시험",
  assignment: "수행평가",
  mock_exam: "모의고사",
  study: "자습",
  school_academy: "학원",
  other: "기타",
};

const EVENT_TYPE_COLOR: Record<string, string> = {
  exam: "bg-blue-100 text-blue-700",
  assignment: "bg-orange-100 text-orange-700",
  mock_exam: "bg-purple-100 text-purple-700",
  study: "bg-green-100 text-green-700",
  school_academy: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${month}/${day} (${days[d.getDay()]})`;
}

function NavCard({
  href,
  title,
  description,
  accent,
  stat,
  statLabel,
}: {
  href: string;
  title: string;
  description: string;
  accent?: string;
  stat?: string | number;
  statLabel?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col justify-between rounded-2xl border bg-white p-6 min-h-[140px] hover:shadow-md transition-shadow ${accent ?? ""}`}
    >
      <div>
        <p className="text-xl font-bold">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex items-end justify-between mt-4">
        {stat != null ? (
          <div>
            <span className="text-2xl font-bold">{stat}</span>
            {statLabel && <span className="text-sm text-muted-foreground ml-1">{statLabel}</span>}
          </div>
        ) : (
          <span />
        )}
        <span className="text-sm text-primary font-medium">바로가기 →</span>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sixMonthsLater = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const currentSemType: SemesterType =
    now.getMonth() + 1 >= 3 && now.getMonth() + 1 <= 8
      ? "semester_1"
      : "semester_2";
  const currentYear = now.getFullYear();

  const [
    { data: rows },
    { data: profileData },
    { data: mockRows },
    { data: scheduleRows },
    { data: taskRows },
  ] =
    await Promise.all([
      supabase
        .from("exams")
        .select(
          "exam_type, subjects(name), semesters!exam_semester(year, semester_type), grade_records(percentage)"
        )
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("school_level, name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("mock_exam_records")
        .select("grade")
        .eq("user_id", user.id)
        .not("grade", "is", null),
      supabase
        .from("schedules")
        .select("id, title, event_type, start_date, subjects(name)")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .gte("start_date", sixMonthsAgo)
        .lte("start_date", sixMonthsLater)
        .order("start_date"),
      supabase
        .from("study_tasks")
        .select("id, title, due_date, priority, subjects(name)")
        .eq("user_id", user.id)
        .eq("is_completed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(6),
    ]);

  const schoolLevel = (profileData?.school_level as "middle" | "high") ?? null;
  const userName = profileData?.name ?? null;

  const validRows = (rows as ExamRow[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    const sem = Array.isArray(r.semesters) ? r.semesters[0] : r.semesters;
    if (!sem) return [];
    return [{
      percentage: Number(pct),
      semesterYear: sem.year,
      semesterType: sem.semester_type as SemesterType,
    }];
  });

  const totalExams = validRows.length;
  const overallAvg =
    totalExams > 0
      ? Math.round((validRows.reduce((a, r) => a + r.percentage, 0) / totalExams) * 10) / 10
      : null;

  const currentSemRows = validRows.filter(
    (r) => r.semesterYear === currentYear && r.semesterType === currentSemType
  );
  const currentSemAvg =
    currentSemRows.length > 0
      ? Math.round(
          (currentSemRows.reduce((a, r) => a + r.percentage, 0) / currentSemRows.length) * 10
        ) / 10
      : null;

  const mockGrades = (mockRows ?? []).map((r) => r.grade as number).filter(Boolean);
  const mockAvgGrade =
    mockGrades.length > 0
      ? Math.round((mockGrades.reduce((a, b) => a + b, 0) / mockGrades.length) * 10) / 10
      : null;

  const allSchedules = (scheduleRows as ScheduleRow[] ?? []);
  const upcoming = allSchedules
    .filter((s) => s.start_date >= today && s.start_date <= twoWeeksLater)
    .slice(0, 10);
  const studyTasks = (taskRows as StudyTaskRow[] ?? []);

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {userName ? `${userName}님의 대시보드` : "대시보드"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          성적 요약, 일정, 분석 결과를 한눈에 확인하세요
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 캘린더 */}
        <DashboardCalendar
          schedules={allSchedules.map((s) => ({
            id: s.id,
            title: s.title,
            event_type: s.event_type,
            start_date: s.start_date,
          }))}
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth()}
          todayStr={today}
        />

        {/* 오른쪽: 네비게이션 카드들 */}
        <div className="space-y-4">
          {schoolLevel === "high" ? (
            /* 고등학생: 내신 + 모의고사 나란히 */
            <div className="grid grid-cols-2 gap-4">
              <NavCard
                href="/grades"
                title="내신"
                description="시험·수행평가 성적 관리"
                stat={currentSemAvg != null ? `${currentSemAvg}점` : "-"}
                statLabel={currentSemAvg != null ? "이번 학기 평균" : undefined}
              />
              <NavCard
                href="/mock-exam"
                title="모의고사"
                description="수능 모의고사 성적 관리"
                accent="border-violet-200"
                stat={mockAvgGrade != null ? `${mockAvgGrade}등급` : "-"}
                statLabel={mockAvgGrade != null ? "평균 등급" : undefined}
              />
            </div>
          ) : (
            /* 중학생: 내신 전폭 카드 */
            <NavCard
              href="/grades"
              title="내신"
              description="시험·수행평가 성적 관리"
              stat={currentSemAvg != null ? `${currentSemAvg}점` : totalExams > 0 ? `${overallAvg}점` : "-"}
              statLabel={currentSemAvg != null ? "이번 학기 평균" : totalExams > 0 ? "전체 평균" : undefined}
            />
          )}

          {/* 분석 + 맞춤전략 */}
          <div className="grid grid-cols-2 gap-4">
            <NavCard
              href="/analytics"
              title="분석"
              description="성적 추이 그래프와 AI 예측"
              stat={totalExams > 0 ? `${totalExams}회` : undefined}
              statLabel={totalExams > 0 ? "누적 시험" : undefined}
            />
            <NavCard
              href="/strategy"
              title="맞춤전략"
              description="취약점, 우선순위, 장기 계획"
            />
          </div>

          {/* 다가오는 일정 */}
          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center mb-4">
              <h2 className="font-bold text-lg">다가오는 일정</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                앞으로 2주 내 일정이 없습니다
              </p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s) => {
                  const subjectName = Array.isArray(s.subjects)
                    ? s.subjects[0]?.name
                    : s.subjects?.name;
                  const colorClass =
                    EVENT_TYPE_COLOR[s.event_type] ?? EVENT_TYPE_COLOR.other;
                  return (
                    <li key={s.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-16 shrink-0 text-xs">
                        {formatDate(s.start_date)}
                      </span>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium ${colorClass}`}
                      >
                        {EVENT_TYPE_LABEL[s.event_type] ?? s.event_type}
                      </span>
                      {subjectName && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                          {subjectName}
                        </span>
                      )}
                      <span className="truncate">{s.title}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">이번 주 할 일</h2>
              <Link href="/analytics" className="text-xs text-primary hover:underline">
                관리하기 →
              </Link>
            </div>
            {studyTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                진행 중인 공부 할 일이 없습니다
              </p>
            ) : (
              <ul className="space-y-2">
                {studyTasks.map((task) => {
                  const subjectName = Array.isArray(task.subjects)
                    ? task.subjects[0]?.name
                    : task.subjects?.name;
                  const displaySubjectName = subjectName ?? "기타";
                  const priority = task.priority ?? "medium";
                  return (
                    <li key={task.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium ${PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.medium}`}
                      >
                        {PRIORITY_LABEL[priority] ?? priority}
                      </span>
                      <span className="truncate">
                        {displaySubjectName} · {task.title}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {task.due_date ? formatDate(task.due_date) : "마감 없음"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
