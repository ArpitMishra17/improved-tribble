import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AiPipelineSummaryProps {
  pipelineHealthScore: { score: number; tag: string };
  preGeneratedSummary?: string | undefined;
  aiLoading?: boolean | undefined;
  generatedAt?: string | undefined;
}

export function AiPipelineSummary({
  pipelineHealthScore,
  preGeneratedSummary,
  aiLoading = false,
  generatedAt,
}: AiPipelineSummaryProps) {
  const fallback =
    pipelineHealthScore.score >= 80
      ? "Pipeline looks healthy overall. Keep candidates moving to maintain momentum."
      : pipelineHealthScore.score >= 60
        ? "Pipeline is stable but watch for slow stages and review stuck candidates."
        : "Pipeline risk detected. Focus on clearing bottlenecks and reviewing stuck candidates.";

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">AI pipeline summary</CardTitle>
          <CardDescription>
            AI-assisted narrative based on current KPIs.
            {formattedDate && (
              <span className="text-slate-400 ml-2">Generated {formattedDate}</span>
            )}
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          AI-assisted
        </Badge>
      </CardHeader>
      <CardContent>
        {aiLoading && <p className="text-sm text-slate-500">Generating insight…</p>}
        {!aiLoading && (
          <p className="text-sm text-slate-800 leading-relaxed">
            {preGeneratedSummary || fallback}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
