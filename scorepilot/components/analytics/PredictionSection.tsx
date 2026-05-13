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

function confidenceLabel(confidence: number) {
  if (confidence >= 0.8) return { text: "높음", cls: "bg-green-100 text-green-700" };
  if (confidence >= 0.6) return { text: "보통", cls: "bg-yellow-100 text-yellow-700" };
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

  const avgMap = new Map(subjectAvgs.map((subject) => [subject.subject, subject.avg]));

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
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          과목별 가중 선형 추세 모델 기반 예측
        </p>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "분석 중..." : predictions.length === 0 ? "예측 생성" : "새로고침"}
        </button>
      </div>

      {predictions.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <p>예측 생성 버튼을 눌러 AI 성적 예측을 시작하세요.</p>
          <p className="mt-1 text-xs">성적 기록이 1개 이상인 과목부터 예측할 수 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {predictions.map((prediction) => {
            const currentAvg = avgMap.get(prediction.subject_name);
            const delta =
              currentAvg !== undefined ? prediction.predicted_score - currentAvg : null;
            const confidence = confidenceLabel(prediction.confidence);

            return (
              <div key={prediction.subject_name} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{prediction.subject_name}</p>
                    <p className="text-xs text-muted-foreground">{prediction.prediction_target}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidence.cls}`}>
                    신뢰도 {confidence.text}
                  </span>
                </div>

                <div className="flex items-end gap-3">
                  <span className={`text-3xl font-bold ${scoreColor(prediction.predicted_score)}`}>
                    {prediction.predicted_score}%
                  </span>
                  {delta !== null && (
                    <span
                      className={`pb-0.5 text-sm font-medium ${
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

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>신뢰도</span>
                    <span>{Math.round(prediction.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${prediction.confidence * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">{prediction.basis}</p>
              </div>
            );
          })}
        </div>
      )}

      {predictions.length > 0 && (
        <p className="mt-4 text-right text-xs text-muted-foreground" suppressHydrationWarning>
          마지막 업데이트: {new Date(predictions[0].created_at).toLocaleString("ko-KR")}
        </p>
      )}
    </div>
  );
}
