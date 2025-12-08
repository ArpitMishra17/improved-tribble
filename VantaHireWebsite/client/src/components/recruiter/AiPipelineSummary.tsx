import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { callLLM } from "@/lib/ai/llmClient";

type DropoffInsight = {
  name: string;
  rate: number;
  count: number;
};

type StageCount = { name: string; count: number };

interface AiPipelineSummaryProps {
  pipelineHealthScore: { score: number; tag: string };
  timeRangeLabel: string;
  applicationsOverTime: Array<{ date: string; value: number }>;
  stageDistribution: StageCount[];
  dropoff: DropoffInsight[];
  timeInStage?: Array<{ stageName: string; averageDays: number }>;
  jobsNeedingAttentionCount: number;
}

export function AiPipelineSummary({
  pipelineHealthScore,
  timeRangeLabel,
  applicationsOverTime,
  stageDistribution,
  dropoff,
  timeInStage = [],
  jobsNeedingAttentionCount,
}: AiPipelineSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const payload = {
        pipelineHealthScore,
        timeRangeLabel,
        applicationsOverTime: applicationsOverTime.slice(-14), // keep prompt compact
        stageDistribution,
        dropoff,
        timeInStage: timeInStage.map((t) => ({ stageName: t.stageName, averageDays: t.averageDays })),
        jobsNeedingAttentionCount,
      };
      const prompt = `You are helping a recruiter interpret their hiring pipeline. Here is the data:\n\n${JSON.stringify(
        payload,
        null,
        2
      )}\n\nWrite a concise 1–2 sentence summary about what is healthy and what needs attention. Do not invent numbers; use only what is provided.`;
      try {
        const aiText = await callLLM(prompt);
        if (!cancelled) setSummary(aiText);
      } catch (err) {
        console.error("AI summary failed, falling back:", err);
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [applicationsOverTime, dropoff, jobsNeedingAttentionCount, pipelineHealthScore, stageDistribution, timeInStage, timeRangeLabel]);

  const fallback =
    pipelineHealthScore.score >= 80
      ? "Pipeline looks healthy overall. Keep candidates moving to maintain momentum."
      : pipelineHealthScore.score >= 60
        ? "Pipeline is stable but watch for slow stages and review stuck candidates."
        : "Pipeline risk detected. Focus on clearing bottlenecks and reviewing stuck candidates.";

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">AI pipeline summary</CardTitle>
          <CardDescription>AI-assisted narrative based on current KPIs.</CardDescription>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          AI-assisted
        </Badge>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-slate-500">Generating insight…</p>}
        {!loading && (
          <p className="text-sm text-slate-800 leading-relaxed">
            {summary || fallback}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
