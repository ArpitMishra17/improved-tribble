import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { callLLM } from "@/lib/ai/llmClient";
import { DropoffAiExplanation } from "./DropoffAiExplanation";

type JobAttention = {
  jobId: number;
  title: string;
  severity: "high" | "medium" | "low";
  reason: string;
  nextAction?: string;
  metrics?: Record<string, any>;
};

type JdSuggestion = {
  jobId: number;
  title: string;
  score: string;
  tips: string[];
};

type DropoffStep = {
  name: string;
  count: number;
  rate: number;
};

type Bottleneck = {
  stage: string;
  message: string;
  actionLabel?: string;
};

interface RecruiterAiInsightsSectionProps {
  jobsNeedingAttention: JobAttention[];
  jdSuggestions: JdSuggestion[];
  dropoff: DropoffStep[];
  dropoffSummary: string;
  bottlenecks: Bottleneck[];
  onViewJob?: (jobId: number) => void;
  onEditJob?: (jobId: number) => void;
  onViewStage?: (stageName: string) => void;
}

const severityColor: Record<JobAttention["severity"], string> = {
  high: "bg-red-100 text-red-800 border-red-300",
  medium: "bg-orange-100 text-orange-800 border-orange-300",
  low: "bg-amber-50 text-amber-700 border-amber-200",
};

export function RecruiterAiInsightsSection({
  jobsNeedingAttention,
  jdSuggestions,
  dropoff,
  dropoffSummary,
  bottlenecks,
  onViewJob,
  onEditJob,
  onViewStage,
}: RecruiterAiInsightsSectionProps) {
  const worstRate =
    dropoff.length > 0
      ? dropoff.reduce((min, step) => (step.rate < min ? step.rate : min), dropoff[0]?.rate ?? 0)
      : null;

  // AI next-action suggestions per job (fail-soft)
  const [aiNextActions, setAiNextActions] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      const summaries = await Promise.all(
        jobsNeedingAttention.map(async (job) => {
          const payload = {
            title: job.title,
            severity: job.severity,
            reason: job.reason,
            metrics: job.metrics || {},
          };
          const prompt = `You are helping a recruiter prioritize a job. Given this job context, propose one short next action (max 18 words).\n\n${JSON.stringify(
            payload,
            null,
            2
          )}\n\nUse only the provided info.`;
          try {
            const res = await callLLM(prompt);
            return { id: job.jobId, text: res };
          } catch (err) {
            console.warn("AI next-action failed", err);
            return { id: job.jobId, text: "" };
          }
        })
      );
      if (!cancelled) {
        const map: Record<number, string> = {};
        summaries.forEach((s) => {
          if (s.text) map[s.id] = s.text;
        });
        setAiNextActions(map);
      }
    };
    if (jobsNeedingAttention.length) generate();
    return () => {
      cancelled = true;
    };
  }, [jobsNeedingAttention]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Jobs Needing Attention
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Sorted by severity
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">AI-assisted</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobsNeedingAttention.map((job) => (
              <div
                key={job.jobId}
                role="button"
                tabIndex={0}
                  onClick={() => onViewJob?.(job.jobId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onViewJob?.(job.jobId);
                  }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-slate-900">{job.title}</div>
                    <span
                      className={cn(
                          "flex items-center gap-1 text-xs font-medium px-2 py-[2px] rounded-full border",
                          severityColor[job.severity]
                        )}
                      >
                        <span className="h-2 w-2 rounded-full bg-current" />
                        {job.severity.toUpperCase()}
                      </span>
                  </div>
                  <p className="text-sm text-slate-600">{job.reason}</p>
                  {(job.nextAction || aiNextActions[job.jobId]) && (
                    <p className="text-xs text-slate-500">
                      Suggested next action:{" "}
                      <span className="font-medium text-slate-700">{aiNextActions[job.jobId] || job.nextAction}</span>
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => onViewJob?.(job.jobId)}>
                  View job
                </Button>
              </div>
            ))}
            {jobsNeedingAttention.length === 0 && (
              <p className="text-sm text-slate-500">No risk indicators right now.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                JD Clarity Suggestions
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Improving clarity can lift apply rates for similar roles.
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">AI-assisted</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {jdSuggestions.length === 0 && (
                <p className="text-sm text-slate-500">No JD clarity flags detected for the selected filters.</p>
              )}
              {jdSuggestions.map((item) => (
                <div key={item.jobId} className="rounded-lg border border-slate-200 p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <Badge variant="outline" className="text-xs">
                      {item.score}
                    </Badge>
                  </div>
                  <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1 mt-2">
                    {item.tips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => onEditJob?.(item.jobId)}>
                      Edit JD
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Drop-off Analysis
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Stage counts and conversions
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">AI-assisted</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {dropoff.map((step) => (
                <div
                  key={step.name}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md p-2",
                    worstRate !== null && step.rate === worstRate ? "bg-red-50 border border-red-100" : "bg-slate-50"
                  )}
                >
                  <div className="text-sm text-slate-800 font-medium">{step.name}</div>
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <span>{step.rate}% conversion</span>
                    <span className="text-slate-600">{step.count} candidates</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
              {dropoffSummary}
            </div>
            <DropoffAiExplanation dropoff={dropoff} fallback={dropoffSummary} />
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="text-sm font-semibold text-slate-800">Stage bottlenecks</div>
              {bottlenecks.length === 0 && (
                <p className="text-sm text-slate-500">No stage bottlenecks detected in this period.</p>
              )}
              {bottlenecks.length > 0 && (
                <ul className="space-y-2">
                  {bottlenecks.map((item, idx) => (
                    <li
                      key={`${item.stage}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md bg-amber-50 border border-amber-100 p-3"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-amber-800">{item.stage}</div>
                        <p className="text-sm text-amber-700">{item.message}</p>
                      </div>
                      {item.actionLabel && (
                        <Button variant="outline" size="sm" onClick={() => onViewStage?.(item.stage)}>
                          {item.actionLabel}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
