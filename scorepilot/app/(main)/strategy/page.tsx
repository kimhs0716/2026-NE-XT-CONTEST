import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type SubjectAvg = { subject: string; avg: number };

function computeSubjectAvgs(rows: { subject: string; percentage: number }[]): SubjectAvg[] {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    if (!map.has(r.subject)) map.set(r.subject, []);
    map.get(r.subject)!.push(r.percentage);
  }
  return [...map.entries()]
    .map(([subject, pcts]) => ({
      subject,
      avg: Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10,
    }))
    .sort((a, b) => a.avg - b.avg);
}

export default async function StrategyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("exams")
    .select(`
      subjects ( name ),
      grade_records ( percentage )
    `)
    .eq("user_id", user.id);

  const validRows = ((rows ?? []) as { subjects: { name: string } | { name: string }[] | null; grade_records: { percentage: number }[] }[]).flatMap((r) => {
    const pct = r.grade_records[0]?.percentage;
    if (pct == null) return [];
    const name = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    if (!name) return [];
    return [{ subject: name, percentage: Number(pct) }];
  });

  const subjectAvgs = computeSubjectAvgs(validRows);
  const weak = subjectAvgs.filter((s) => s.avg < 60);
  const caution = subjectAvgs.filter((s) => s.avg >= 60 && s.avg < 80);
  const strong = subjectAvgs.filter((s) => s.avg >= 80);

  const hasPriority = weak.length > 0 || caution.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">맞춤전략</h1>
        <p className="text-muted-foreground text-sm mt-1">
          성적 데이터를 바탕으로 분석한 나만의 학습 전략
        </p>
      </div>

      {validRows.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center text-muted-foreground text-sm">
          성적을 등록하면 맞춤 전략이 생성됩니다.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* 취약점 분석 */}
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">취약점 분석</h2>
            {weak.length === 0 ? (
              <p className="text-sm text-muted-foreground">취약 과목이 없습니다 🎉</p>
            ) : (
              <div className="space-y-2">
                {weak.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-red-700">{s.subject}</span>
                    <span className="text-red-500 font-semibold">{s.avg}%</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  평균 60% 미만 과목 — 집중적인 학습이 필요합니다
                </p>
              </div>
            )}
          </div>

          {/* 우선순위 */}
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">학습 우선순위</h2>
            {!hasPriority ? (
              <p className="text-sm text-muted-foreground">모든 과목이 우수합니다 🏆</p>
            ) : (
              <div className="space-y-3">
                {weak.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">1순위 — 즉시 보강</p>
                    {weak.map((s) => (
                      <div key={s.subject} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                        <span>{s.subject}</span>
                      </div>
                    ))}
                  </div>
                )}
                {caution.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">2순위 — 꾸준히 유지</p>
                    {caution.map((s) => (
                      <div key={s.subject} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                        <span>{s.subject}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 장기 계획 */}
          <div className="rounded-xl border bg-white p-6 space-y-4">
            <h2 className="text-base font-semibold">장기 계획 제안</h2>
            <div className="space-y-3 text-sm">
              {strong.length > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                  <p className="font-medium text-green-700 mb-1">강점 유지</p>
                  <p className="text-green-600 text-xs">{strong.map((s) => s.subject).join(", ")} 과목의 강점을 지속적으로 유지하세요</p>
                </div>
              )}
              {weak.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                  <p className="font-medium text-red-700 mb-1">집중 보강 계획</p>
                  <p className="text-red-600 text-xs">{weak.map((s) => s.subject).join(", ")} 과목은 매일 최소 30분 이상 집중 학습을 권장합니다</p>
                </div>
              )}
              {caution.length > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2.5">
                  <p className="font-medium text-yellow-700 mb-1">꾸준한 관리</p>
                  <p className="text-yellow-600 text-xs">{caution.map((s) => s.subject).join(", ")} 과목은 주 3회 이상 복습하며 80% 이상을 목표로 하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
