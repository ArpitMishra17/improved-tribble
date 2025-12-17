import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Sparkles, TrendingUp, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type JobAttention = {
  jobId: number;
  title: string;
  severity: "high" | "medium" | "low";
  reason: string;
  nextAction?: string;
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
  stuckCount?: number;
  avgDays?: number;
};

interface RecruiterAiInsightsSectionProps {
  jobsNeedingAttention: JobAttention[];
  jdSuggestions: JdSuggestion[];
  dropoff: DropoffStep[];
  dropoffSummary: string;
  bottlenecks: Bottleneck[];
  preGeneratedActions?: Array<{ jobId: number; nextAction: string }> | undefined;
  preGeneratedDropoffExplanation?: string | undefined;
  aiLoading?: boolean | undefined;
  onViewJob?: ((jobId: number) => void) | undefined;
  onEditJob?: ((jobId: number) => void) | undefined;
  onViewStage?: ((stageName: string) => void) | undefined;
}

const severityConfig = {
  high: { color: "bg-destructive/100", border: "border-l-red-500", text: "text-destructive", label: "Urgent" },
  medium: { color: "bg-orange-400", border: "border-l-orange-400", text: "text-warning-foreground", label: "Watch" },
  low: { color: "bg-amber-300", border: "border-l-amber-300", text: "text-warning-foreground", label: "Info" },
};

export function RecruiterAiInsightsSection({
  jobsNeedingAttention,
  jdSuggestions,
  dropoff,
  dropoffSummary,
  bottlenecks,
  preGeneratedActions,
  preGeneratedDropoffExplanation,
  aiLoading = false,
  onViewJob,
  onEditJob,
  onViewStage,
}: RecruiterAiInsightsSectionProps) {
  const [showAllJobs, setShowAllJobs] = useState(false);
  const [jdExpanded, setJdExpanded] = useState<number | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(true);

  // Build a map of pre-generated next actions by jobId
  const actionsMap = useMemo(() => {
    const map: Record<number, string> = {};
    preGeneratedActions?.forEach((a) => {
      if (a.nextAction) map[a.jobId] = a.nextAction;
    });
    return map;
  }, [preGeneratedActions]);

  // Progressive disclosure: show top 3
  const visibleJobs = showAllJobs ? jobsNeedingAttention : jobsNeedingAttention.slice(0, 3);
  const hasMoreJobs = jobsNeedingAttention.length > 3;

  // Find max count for funnel bar scaling
  const maxCount = Math.max(...dropoff.map((d) => d.count), 1);

  return (
    <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
      <div className="flex items-center justify-between mb-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-foreground hover:text-foreground p-0">
            {insightsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold">AI Insights</span>
            <Badge variant="outline" className="text-[10px] ml-2">AI-assisted</Badge>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            {/* Jobs Needing Attention - Compact Cards */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Needs Attention
                  {jobsNeedingAttention.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">{jobsNeedingAttention.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {visibleJobs.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">All jobs healthy</p>
                )}
                <TooltipProvider>
                  {visibleJobs.map((job) => {
                    const config = severityConfig[job.severity];
                    const action = actionsMap[job.jobId] || job.nextAction;
                    return (
                      <Tooltip key={job.jobId}>
                        <TooltipTrigger asChild>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onViewJob?.(job.jobId)}
                            onKeyDown={(e) => { if (e.key === "Enter") onViewJob?.(job.jobId); }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md border-l-4 bg-muted/50 hover:bg-muted cursor-pointer transition-colors",
                              config.border
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-foreground truncate">{job.title}</span>
                                <span className={cn("text-[10px] font-medium uppercase", config.text)}>{config.label}</span>
                              </div>
                              {action && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{action}</p>
                              )}
                              {aiLoading && !action && (
                                <p className="text-xs text-muted-foreground italic">Generating...</p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-sm">{job.reason}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
                {hasMoreJobs && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowAllJobs(!showAllJobs)}
                  >
                    {showAllJobs ? "Show less" : `Show ${jobsNeedingAttention.length - 3} more`}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* JD Suggestions - Accordion */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  JD Improvements
                  {jdSuggestions.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">{jdSuggestions.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {jdSuggestions.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">All JDs look good</p>
                )}
                {jdSuggestions.map((item) => (
                  <Collapsible
                    key={item.jobId}
                    open={jdExpanded === item.jobId}
                    onOpenChange={(open) => setJdExpanded(open ? item.jobId : null)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors">
                        <div className="flex items-center gap-2">
                          {jdExpanded === item.jobId ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm text-foreground">{item.title}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{item.score}</Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-5 pr-2 py-2 space-y-2">
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {item.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onEditJob?.(item.jobId)}>
                          Edit JD
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* Dropoff Analysis - Horizontal Funnel Bars */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-info" />
                  Conversion Funnel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  {dropoff.map((step, idx) => {
                    const barWidth = Math.max((step.count / maxCount) * 100, 8);
                    const isWeak = step.rate < 50;
                    return (
                      <div key={step.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium">{step.name}</span>
                          <span className={cn("tabular-nums", isWeak ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {step.rate}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              isWeak ? "bg-red-400" : idx === 0 ? "bg-info/100" : "bg-blue-400"
                            )}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">{step.count} candidates</div>
                      </div>
                    );
                  })}
                </div>
                {/* AI Summary */}
                {dropoff.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {preGeneratedDropoffExplanation || dropoffSummary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stage Bottlenecks - Heatmap Bars */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  Stage Delays
                  {bottlenecks.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-auto">{bottlenecks.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {bottlenecks.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No delays detected</p>
                )}
                <div className="space-y-2">
                  {bottlenecks.map((item, idx) => {
                    // Extract stuck count from message (e.g., "5 candidate(s)...")
                    const countMatch = item.message.match(/(\d+)\s+candidate/);
                    const stuckCount = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : 1;
                    const intensity = Math.min(stuckCount / 5, 1); // Scale to max 5 for intensity
                    return (
                      <div
                        key={`${item.stage}-${idx}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onViewStage?.(item.stage)}
                        onKeyDown={(e) => { if (e.key === "Enter") onViewStage?.(item.stage); }}
                        className="flex items-center gap-3 p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      >
                        {/* Heatmap intensity bar */}
                        <div
                          className="w-1.5 h-8 rounded-full"
                          style={{
                            backgroundColor: `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground">{item.stage}</div>
                          <p className="text-xs text-muted-foreground truncate">{stuckCount} stuck</p>
                        </div>
                        {item.actionLabel && (
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                            View
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
