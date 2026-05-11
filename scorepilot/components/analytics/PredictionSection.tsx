"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePredictions } from "@/lib/actions/predictions";

type Prediction = {
  subject_name: string;
  predicted_score: number;
  prediction_target: string;
  confidence: number;
  basis: string;
  created_at: string;
};

type SubjectAvg = {
  subject: string;
  avg: number;
};

function scoreColor(score: number) {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-500";
}

function confidenceLabel(c: number) {
  if (c >= 0.8) return { text: "높음", cls: "bg-green-100 text-green-700" };
  if (c >= 0.6) return { text: "보통", cls: "bg-yellow-100 text-yellow-700" };
  return { text: "낮음", cls: "bg-gray-100 text-gray-600" };
}

export default function PredictionSection({
  predictions,
  subjectAvgs,
}: {
  predictions: Prediction[];
  subjectAvgs: SubjectAvg[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const avgMap = new Map(subjectAvgs.map((s) => [s.subject, s.avg]));

  function handleGenerate() {
    startTransition(async () => {
      const res = await generatePredictions();
      if (res && "error" in res) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold">AI 성적 예측</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            과목별 가중 선형 추세 모델 기반 예측
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "분석 중…" : predictions.length === 0 ? "예측 생성" : "새로고침"}
        </button>
      </div>

      {predictions.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <p className="text-2xl mb-2">🔮</p>
          <p>예측 생성 버튼을 눌러 AI 성적 예측을 시작하세요.</p>
          <p className="text-xs mt-1">성적 기록이 1개 이상인 과목부터 예측이 가능합니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {predictions.map((p) => {
            const currentAvg = avgMap.get(p.subject_name);
            const delta =
              currentAvg !== undefined ? p.predicted_score - currentAvg : null;
            const conf = confidenceLabel(p.confidence);

            return (
              <div
                key={p.subject_name}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{p.subject_name}</p>
                    <p className="text-xs text-muted-foreground">{p.prediction_target}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conf.cls}`}>
                    신뢰도 {conf.text}
                  </span>
                </div>

                <div className="flex items-end gap-3">
                  <span className={`text-3xl font-bold ${scoreColor(p.predicted_score)}`}>
                    {p.predicted_score}%
                  </span>
                  {delta !== null && (
                    <span
                      className={`text-sm font-medium pb-0.5 ${
                        delta > 0
                          ? "text-green-600"
                          : delta < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Confidence bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>신뢰도</span>
                    <span>{Math.round(p.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${p.confidence * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{p.basis}</p>
              </div>
            );
          })}
        </div>
      )}

      {predictions.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 text-right" suppressHydrationWarning>
          마지막 업데이트: {new Date(predictions[0].created_at).toLocaleString("ko-KR")}
        </p>
      )}
    </div>
  );
}
