import { createClient } from "@/lib/supabase/server";
import GradeChart from "@/components/analytics/GradeChart";
import PredictionSection from "@/components/analytics/PredictionSection";

type Row = {
  exam_date: string;
  exam_type: string;
  subjects: { name: string } | { name: string }[] | null;
  grade_records: { percentage: number }[];
};

const EXAM_TYPES = ["midterm", "final", "mock_exam"];
const ASSIGNMENT_TYPES = ["assignment"];

function buildChartData(rows: { date: string; subject: string; percentage: number }[]) {
  const subjects = [...new Set(rows.map((r) => r.subject))];
  const byDate = new Map<string, Record<string, number | null>>();
  for (const r of rows) {
    if (!byDate.has(r.date)) {
      byDate.set(r.date, Object.fromEntries(subjects.map((s) => [s, null])));
    }
    byDate.get(r.date)![r.subject] = r.percentage;
  }
  const data = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => {
      const values = Object.values(scores).filter((v): v is number => v !== null);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        date,
        ...scores,
        "전체 평균": avg !== null ? Math.round(avg * 10) / 10 : null,
      };
    });
  return { data, subjects };
}

type SubjectStat = {
  subject: string;
  count: number;
  avg: number;
  max: number;
  min: number;
  trend: "up" | "down" | "stable" | "new";
  level: "strong" | "caution" | "weak";
};

function computeSubjectStats(
  rows: { subject: string; percentage: number; date: string }[]
): SubjectStat[] {
  const map = new Map<string, { percentage: number; date: string }[]>();
  for (const r of rows) {
    if (!map.has(r.subject)) map.set(r.subject, []);
    map.get(r.subject)!.push(r);
  }
  return [...map.entries()]
    .map(([subject, entries]) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      const pcts = sorted.map((e) => e.percentage);
      const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      const last = pcts[pcts.length - 1];
      const prev = pcts.length > 1 ? pcts[pcts.length - 2] : null;
      let trend: SubjectStat["trend"] = "new";
      if (prev !== null) {
        if (last - prev > 3) trend = "up";
        else if (prev - last > 3) trend = "down";
        else trend = "stable";
      }
      const roundedAvg = Math.round(avg * 10) / 10;
      return {
        subject,
        count: pcts.length,
        avg: roundedAvg,
        max: Math.max(...pcts),
        min: Math.min(...pcts),
        trend,
        level: (roundedAvg >= 80 ? "strong" : roundedAvg >= 60 ? "caution" : "weak") as SubjectStat["level"],
      };
    })
    .sort((a, b) => a.avg - b.avg);
}

const trendIcon = (t: SubjectStat["trend"]) =>
  t === "up" ? "↑" : t === "down" ? "↓" : t === "stable" ? "→" : "•";
const trendColor = (t: SubjectStat["trend"]) =>
  t === "up" ? "text-green-600" : t === "down" ? "text-red-500" : "text-muted-foreground";
const levelBadgeClass = (l: SubjectStat["level"]) =>
  l === "strong"
    ? "bg-green-100 text-green-700"
    : l === "caution"
    ? "bg-yellow-100 text-yellow-700"
    : "bg-red-100 text-red-600";
const levelLabel = (l: SubjectStat["level"]) =>
  l === "strong" ? "우수" : l === "caution" ? "보통" : "취약";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rows }, { data: predRows }] = await Promise.all([
    supabase
      .from("exams")
      .select(`
        exam_date,
        exam_type,
        subjects ( name ),
        grade_records ( percentage )
      `)
      .eq("user_id", user!.id)
      .order("exam_date", { ascending: true }),
    supabase
      .from("score_predictions")
      .select(`
        predicted_score,
        prediction_target,
        confidence,
        basis,
        created_at,
        subjects ( name )
      `)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const validRows = (rows as Row[] ?? []).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    return [{ date: r.exam_date, examType: r.exam_type, subject: name, percentage: Number(pct) }];
  });

  const examRows = validRows.filter((r) => EXAM_TYPES.includes(r.examType));
  const assignmentRows = validRows.filter((r) => ASSIGNMENT_TYPES.includes(r.examType));

  const exam = buildChartData(examRows);
  const assignment = buildChartData(assignmentRows);

  const subjectStats = computeSubjectStats(validRows);

  const predictions = (predRows ?? []).map((r) => {
    const sub = Array.isArray(r.subjects) ? r.subjects[0] : r.subjects;
    return {
      subject_name: sub?.name ?? "",
      predicted_score: Number(r.predicted_score),
      prediction_target: r.prediction_target,
      confidence: Number(r.confidence),
      basis: r.basis,
      created_at: r.created_at,
    };
  }).filter((p) => p.subject_name);

  const subjectAvgs = subjectStats.map((s) => ({ subject: s.subject, avg: s.avg }));

  const weakSubjects = subjectStats.filter((s) => s.level === "weak");
  const downSubjects = subjectStats.filter((s) => s.trend === "down");
  const upSubjects = subjectStats.filter((s) => s.trend === "up");

  const feedbacks: { type: "danger" | "warning" | "success" | "info"; message: string }[] = [];
  if (weakSubjects.length > 0)
    feedbacks.push({ type: "danger", message: `${weakSubjects.map((s) => s.subject).join(", ")} 과목은 평균 60% 미만입니다. 집중적인 학습이 필요합니다.` });
  if (downSubjects.length > 0)
    feedbacks.push({ type: "warning", message: `${downSubjects.map((s) => s.subject).join(", ")} 과목의 최근 성적이 하락하고 있습니다.` });
  if (upSubjects.length > 0)
    feedbacks.push({ type: "success", message: `${upSubjects.map((s) => s.subject).join(", ")} 과목의 성적이 향상되고 있습니다.` });
  if (subjectStats.length > 0 && weakSubjects.length === 0 && downSubjects.length === 0)
    feedbacks.push({ type: "info", message: "전반적으로 안정적인 성적을 유지하고 있습니다." });

  const feedbackStyle = {
    danger: "bg-red-50 border-red-200 text-red-700",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
    success: "bg-green-50 border-green-200 text-green-700",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">성적 분석</h1>
        <p className="text-muted-foreground text-sm mt-1">
          과목별 성적 추이를 확인하세요
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-base font-semibold mb-6">시험 성적 추이</h2>
          <GradeChart data={exam.data} subjects={exam.subjects} />
        </div>
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-base font-semibold mb-6">수행평가 성적 추이</h2>
          <GradeChart data={assignment.data} subjects={assignment.subjects} />
        </div>
      </div>

      {subjectStats.length > 0 && (
        <>
          {/* Subject stats table */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="text-base font-semibold mb-4">과목별 통계</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 font-medium">과목</th>
                  <th className="pb-2 font-medium text-right">평균</th>
                  <th className="pb-2 font-medium text-right">최고</th>
                  <th className="pb-2 font-medium text-right">최저</th>
                  <th className="pb-2 font-medium text-right">시험 수</th>
                  <th className="pb-2 font-medium text-right">추이</th>
                  <th className="pb-2 font-medium text-right">등급</th>
                </tr>
              </thead>
              <tbody>
                {subjectStats.map((s) => (
                  <tr key={s.subject} className="border-b last:border-0">
                    <td className="py-2.5 font-medium">{s.subject}</td>
                    <td className="py-2.5 text-right font-semibold">{s.avg}%</td>
                    <td className="py-2.5 text-right text-green-600">{s.max.toFixed(1)}%</td>
                    <td className="py-2.5 text-right text-red-500">{s.min.toFixed(1)}%</td>
                    <td className="py-2.5 text-right text-muted-foreground">{s.count}회</td>
                    <td className={`py-2.5 text-right font-bold ${trendColor(s.trend)}`}>
                      {trendIcon(s.trend)}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${levelBadgeClass(s.level)}`}>
                        {levelLabel(s.level)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Feedback */}
          {feedbacks.length > 0 && (
            <div className="rounded-xl border bg-white p-6 space-y-3">
              <h2 className="text-base font-semibold mb-1">학습 피드백</h2>
              {feedbacks.map((f, i) => (
                <div key={i} className={`rounded-lg border px-4 py-3 text-sm ${feedbackStyle[f.type]}`}>
                  {f.message}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* AI Prediction */}
      <PredictionSection predictions={predictions} subjectAvgs={subjectAvgs} />
    </div>
  );
}
