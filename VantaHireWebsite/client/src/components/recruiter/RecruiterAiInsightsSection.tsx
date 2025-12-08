import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type JobAttention = {
  jobId: number;
  title: string;
  severity: "high" | "medium" | "low";
  reason: string;
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
  onViewStage?: (stageName: string) => void;
}

const severityColor: Record<JobAttention["severity"], string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

export function RecruiterAiInsightsSection({
  jobsNeedingAttention,
  jdSuggestions,
  dropoff,
  dropoffSummary,
  bottlenecks,
  onViewJob,
  onViewStage,
}: RecruiterAiInsightsSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Jobs Needing Attention
            </CardTitle>
            <CardDescription>Sorted by severity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobsNeedingAttention.map((job) => (
              <div
                key={job.jobId}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border border-slate-200 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-slate-900">{job.title}</div>
                    <Badge variant="outline" className={cn("text-xs", severityColor[job.severity])}>
                      {job.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{job.reason}</p>
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
            <CardDescription>Grounded in JD length, location, and skills coverage</CardDescription>
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
            <CardDescription>Stage counts and conversions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {dropoff.map((step, idx) => (
                <div key={step.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{step.name}</span>
                    <span className="text-slate-900 font-semibold">{step.count}</span>
                  </div>
                  <Progress value={Math.min(step.rate, 100)} className="h-2" />
                  {idx > 0 && (
                    <p className="text-xs text-slate-500">
                      {step.rate}% conversion from previous stage
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
              {dropoffSummary}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Stage Bottlenecks
            </CardTitle>
            <CardDescription>Stages that need attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bottlenecks.map((item, idx) => (
              <div
                key={`${item.stage}-${idx}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border border-amber-100 bg-amber-50 p-3"
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
              </div>
            ))}
            {bottlenecks.length === 0 && (
              <p className="text-sm text-slate-500">No bottlenecks detected right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
