import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MockExamView, { type MockExamRecord } from "@/components/mock-exam/MockExamView";

export default async function MockExamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("school_level")
    .eq("id", user!.id)
    .single();

  if (profileData?.school_level !== "high") {
    redirect("/dashboard");
  }

  const { data: records } = await supabase
    .from("mock_exam_records")
    .select("id, exam_year, exam_month, subject, raw_score, percentile, grade, target_score")
    .eq("user_id", user!.id)
    .order("exam_year", { ascending: false })
    .order("exam_month", { ascending: false });

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">모의고사</h1>
        <p className="text-muted-foreground text-sm mt-1">
          수능 모의고사 성적을 과목별로 기록하고 추이를 분석하세요
        </p>
      </div>
      <MockExamView records={(records ?? []) as MockExamRecord[]} />
    </div>
  );
}
