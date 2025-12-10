import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  AlertCircle,
  Wrench,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Circle,
  Sparkles,
  TrendingUp,
  Eye,
  EyeOff,
  CheckCheck,
  XCircle,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  ActionItem,
  PipelineData,
  GroupedActionItems,
  VerificationSummary,
} from "@/lib/pipeline-types";
import {
  generateActionItems,
  createSession,
  loadSession,
  saveSession,
  isSessionStale,
  canReanalyze,
  groupByPriority,
  calculateHealthImpact,
  verifyCompletions,
  fetchAIEnhancements,
  mergeAIEnhancements,
  AIEnhancementResult,
} from "@/lib/pipeline-rules";

interface PipelineActionChecklistProps {
  pipelineData: PipelineData;
  pipelineHealthScore: { score: number; tag: string };
  onRefreshData?: () => void;
}

// Priority configuration for styling
const PRIORITY_CONFIG = {
  urgent: {
    label: "Urgent",
    icon: AlertTriangle,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    iconColor: "text-red-600",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    hoverBg: "hover:bg-red-100/50",
  },
  important: {
    label: "Important",
    icon: AlertCircle,
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    iconColor: "text-amber-600",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    hoverBg: "hover:bg-amber-100/50",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    iconColor: "text-slate-600",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    hoverBg: "hover:bg-slate-100/50",
  },
};

// Health score color based on value
function getHealthColor(score: number): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  if (score >= 70) {
    return {
      bg: "bg-emerald-50",
      border: "border-emerald-300",
      text: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-800",
    };
  }
  if (score >= 50) {
    return {
      bg: "bg-amber-50",
      border: "border-amber-300",
      text: "text-amber-700",
      badge: "bg-amber-100 text-amber-800",
    };
  }
  return {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-700",
    badge: "bg-red-100 text-red-800",
  };
}

function ActionItemRow({
  item,
  isCompleted,
  onToggle,
  onNavigate,
}: {
  item: ActionItem;
  isCompleted: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const config = PRIORITY_CONFIG[item.priority];

  return (
    <div
      className={cn(
        "group flex items-center gap-3 py-3 px-4 rounded-lg transition-all duration-200",
        "border",
        isCompleted
          ? "bg-slate-50/50 border-slate-100"
          : `${config.bgColor} ${config.borderColor}`,
        !isCompleted && config.hoverBg
      )}
      data-testid="pipeline-action-row"
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        className={cn(
          "h-5 w-5 rounded-full border-2 transition-colors",
          isCompleted ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
        )}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium transition-all",
            isCompleted ? "text-slate-400 line-through" : "text-slate-800"
          )}
        >
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {item.description}
          </p>
        )}
      </div>
      {item.link && !isCompleted && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigate}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          View
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
      {isCompleted && (
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
      )}
    </div>
  );
}

function PrioritySection({
  priority,
  items,
  completedIds,
  onToggle,
  onNavigate,
}: {
  priority: "urgent" | "important" | "maintenance";
  items: ActionItem[];
  completedIds: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (link: string) => void;
}) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;
  const completedCount = items.filter((i) => completedIds.has(i.id)).length;

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.iconColor)} />
        <span className="text-sm font-semibold text-slate-700">
          {config.label}
        </span>
        <Badge variant="outline" className={config.badgeClass}>
          {completedCount}/{items.length}
        </Badge>
      </div>
      <div className="space-y-2 pl-6">
        {items.map((item) => (
          <ActionItemRow
            key={item.id}
            item={item}
            isCompleted={completedIds.has(item.id)}
            onToggle={() => onToggle(item.id)}
            onNavigate={() => item.link && onNavigate(item.link)}
          />
        ))}
      </div>
    </div>
  );
}

function VerificationSummaryPanel({
  summary,
  onClose,
}: {
  summary: VerificationSummary;
  onClose: () => void;
}) {
  const allVerified = summary.unverified === 0;

  return (
    <div
      className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4 space-y-3"
      data-testid="verification-summary"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCheck className="h-5 w-5 text-emerald-600" />
          <h4 className="font-semibold text-emerald-800">
            Verification Summary
          </h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <EyeOff className="h-4 w-4 text-slate-500" />
        </Button>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-emerald-700 font-medium">
            {summary.verified} verified
          </span>
        </div>
        {summary.unverified > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-amber-500" />
            <span className="text-amber-700 font-medium">
              {summary.unverified} unverified
            </span>
          </div>
        )}
        {summary.manual > 0 && (
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-blue-500" />
            <span className="text-blue-700 font-medium">
              {summary.manual} manual
            </span>
          </div>
        )}
      </div>

      {/* Individual changes */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {summary.changes.map((change) => (
          <div
            key={change.itemId}
            className={cn(
              "flex items-center gap-2 text-xs p-2 rounded",
              change.verified ? "bg-emerald-100/50" : "bg-amber-100/50"
            )}
          >
            {change.verified ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate flex-1 text-slate-700">
              {change.title}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                change.mode === "auto"
                  ? "bg-blue-50 text-blue-600 border-blue-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              )}
            >
              {change.mode === "auto" ? "Auto" : "Manual"}
            </Badge>
            {change.mode === "auto" && change.change !== "n/a" && (
              <span className="text-slate-500 font-mono text-[10px]">
                {change.change}
              </span>
            )}
          </div>
        ))}
      </div>

      {allVerified && (
        <p className="text-xs text-emerald-600">
          All completed actions have been verified. Great work!
        </p>
      )}
    </div>
  );
}

export function PipelineActionChecklist({
  pipelineData,
  pipelineHealthScore,
  onRefreshData,
}: PipelineActionChecklistProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [verificationSummary, setVerificationSummary] = useState<VerificationSummary | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [enhancedItems, setEnhancedItems] = useState<ActionItem[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Generate items from pipeline data
  const baseItems = useMemo(
    () => generateActionItems(pipelineData),
    [pipelineData]
  );

  // Use enhanced items if available, otherwise base items
  const items = enhancedItems.length > 0 ? enhancedItems : baseItems;

  const groupedItems = useMemo(() => groupByPriority(items), [items]);

  // Fetch AI enhancements on initial load
  useEffect(() => {
    if (baseItems.length === 0 || enhancedItems.length > 0) return;

    const enhance = async () => {
      setIsEnhancing(true);
      const result = await fetchAIEnhancements(baseItems, {
        healthScore: pipelineHealthScore.score,
        totalCandidates: pipelineData.unreviewedCount + Object.values(pipelineData.stuckByStage).reduce((sum, s) => sum + s.count, 0),
        openJobs: pipelineData.jobsWithLowPipeline.length + pipelineData.staleJobs.length,
      });

      if (result && result.enhancements.length > 0) {
        const merged = mergeAIEnhancements(baseItems, result.enhancements);
        setEnhancedItems(merged);
        setAiInsights(result.additionalInsights || []);
      }
      setIsEnhancing(false);
    };

    enhance();
  }, [baseItems, pipelineHealthScore.score, pipelineData]);

  const healthImpact = useMemo(
    () => calculateHealthImpact(items),
    [items]
  );

  // Load session from localStorage on mount
  useEffect(() => {
    if (!user) return;

    const stored = loadSession(user.id, user.role);
    if (stored && !isSessionStale(stored)) {
      // Check if items changed significantly - if so, regenerate
      const storedItemIds = new Set(stored.items.map((i) => i.id));

      // If items are mostly the same, keep the completion state
      const overlap = baseItems.filter((i) => storedItemIds.has(i.id)).length;
      if (overlap >= baseItems.length * 0.5) {
        setCompletedIds(new Set(stored.completedIds));
        setSessionId(stored.id);
        return;
      }
    }

    // Create new session
    const newSession = createSession(user.id, user.role, pipelineData, baseItems);
    saveSession(newSession);
    setSessionId(newSession.id);
    setCompletedIds(new Set());
  }, [user, baseItems, pipelineData]);

  // Save completion state when it changes
  useEffect(() => {
    if (!user || !sessionId) return;

    const stored = loadSession(user.id, user.role);
    if (stored && stored.id === sessionId) {
      saveSession({
        ...stored,
        completedIds: Array.from(completedIds),
      });
    }
  }, [completedIds, user, sessionId]);

  const toggleItem = useCallback((itemId: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (link: string) => {
      setLocation(link);
    },
    [setLocation]
  );

  // Check reanalyze eligibility
  const reanalyzeCheck = useMemo(() => {
    if (!user || !sessionId) {
      return { allowed: false, reason: "Loading..." };
    }
    const stored = loadSession(user.id, user.role);
    if (!stored) {
      return { allowed: true, reason: "Ready" };
    }
    return canReanalyze(stored, completedIds);
  }, [user, sessionId, completedIds, items.length]);

  const handleReanalyze = async () => {
    if (!user || !reanalyzeCheck.allowed) return;

    setIsReanalyzing(true);
    setShowVerification(false);

    try {
      // Get old session for verification comparison
      const oldSession = loadSession(user.id, user.role);
      const oldSnapshot = oldSession?.snapshot;
      const oldItems = oldSession?.items || [];
      const completedItemIds = oldSession?.completedIds || [];

      // Refresh data first
      onRefreshData?.();

      // Short delay to let queries refetch
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Run verification on completed items if we have old data
      if (oldSnapshot && completedItemIds.length > 0) {
        const completedItems = oldItems.filter((item) =>
          completedItemIds.includes(item.id)
        );

        if (completedItems.length > 0) {
          const verificationResult = verifyCompletions(
            completedItems,
            oldSnapshot,
            pipelineData
          );

          // Build summary for display
          const summary: VerificationSummary = {
            verified: verificationResult.verifiedCount,
            unverified: verificationResult.totalCount - verificationResult.verifiedCount,
            manual: verificationResult.manualCount,
            total: verificationResult.totalCount,
            changes: completedItems.map((item) => {
              const result = verificationResult.results[item.id];
              return {
                itemId: item.id,
                title: item.title,
                change: result?.change || 'n/a',
                verified: result?.verified || false,
                mode: result?.mode || 'manual',
              };
            }),
          };

          setVerificationSummary(summary);
          setShowVerification(true);
        }
      }

      // Create new session with fresh data
      const freshItems = generateActionItems(pipelineData);
      const newSession = createSession(
        user.id,
        user.role,
        pipelineData,
        freshItems
      );

      // Store verification result in session
      if (verificationSummary) {
        newSession.lastVerification = {
          results: {},
          verifiedCount: verificationSummary.verified,
          totalCount: verificationSummary.total,
          manualCount: verificationSummary.manual,
          readyForAi: true,
        };
      }

      saveSession(newSession);
      setSessionId(newSession.id);
      setCompletedIds(new Set());

      // Re-fetch AI enhancements for the new items
      setEnhancedItems([]);
      setAiInsights([]);

      const aiResult = await fetchAIEnhancements(freshItems, {
        healthScore: pipelineHealthScore.score,
        totalCandidates: pipelineData.unreviewedCount + Object.values(pipelineData.stuckByStage).reduce((sum, s) => sum + s.count, 0),
        openJobs: pipelineData.jobsWithLowPipeline.length + pipelineData.staleJobs.length,
      });

      if (aiResult && aiResult.enhancements.length > 0) {
        const merged = mergeAIEnhancements(freshItems, aiResult.enhancements);
        setEnhancedItems(merged);
        setAiInsights(aiResult.additionalInsights || []);
      }
    } finally {
      setIsReanalyzing(false);
    }
  };

  const completionRate =
    items.length > 0
      ? Math.round((completedIds.size / items.length) * 100)
      : 100;

  const healthColor = getHealthColor(pipelineHealthScore.score);

  // Calculate projected score after completing all items
  const projectedScore = Math.min(
    100,
    pipelineHealthScore.score + healthImpact.projectedImprovement
  );

  if (items.length === 0) {
    return (
      <Card className={cn("shadow-sm border-2", healthColor.border)}>
        <CardHeader className={cn("pb-4", healthColor.bg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600"
                )}
              >
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">AI-Powered Actions</CardTitle>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                    AI Generated
                  </Badge>
                </div>
                <p className="text-sm text-slate-500">
                  All caught up! Your pipeline is optimized for better hiring.
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className={cn("text-3xl font-bold", healthColor.text)}>
                {pipelineHealthScore.score}%
              </div>
              <Badge className={healthColor.badge}>
                {pipelineHealthScore.tag}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <Sparkles className="h-8 w-8 text-emerald-500" />
            <p className="text-slate-600">
              Great job! No action items at this time.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={isReanalyzing}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 mr-2",
                  isReanalyzing && "animate-spin"
                )}
              />
              Check for updates
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("shadow-sm border-2", healthColor.border)}
      data-testid="pipeline-checklist-card"
    >
      {/* Hero Section - Color coded by health */}
      <CardHeader className={cn("pb-4", healthColor.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600"
              )}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">AI-Powered Actions</CardTitle>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                  AI Generated
                </Badge>
              </div>
              <p className="text-sm text-slate-500">
                {items.length} action{items.length !== 1 ? "s" : ""} to improve your hiring outcomes
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className={cn("text-3xl font-bold", healthColor.text)}>
                {pipelineHealthScore.score}%
              </span>
              {projectedScore > pipelineHealthScore.score && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-emerald-600 font-medium">
                        → {projectedScore}%
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Projected score after completing all items</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Badge className={healthColor.badge}>
              {pipelineHealthScore.tag}
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600">Progress</span>
            <span className="font-medium text-slate-700">
              {completedIds.size}/{items.length} completed
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Action items by priority */}
        <PrioritySection
          priority="urgent"
          items={groupedItems.urgent}
          completedIds={completedIds}
          onToggle={toggleItem}
          onNavigate={handleNavigate}
        />
        <PrioritySection
          priority="important"
          items={groupedItems.important}
          completedIds={completedIds}
          onToggle={toggleItem}
          onNavigate={handleNavigate}
        />
        <PrioritySection
          priority="maintenance"
          items={groupedItems.maintenance}
          completedIds={completedIds}
          onToggle={toggleItem}
          onNavigate={handleNavigate}
        />

        {/* AI insights or explanation */}
        <div
          className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 border border-purple-100"
          data-testid="pipeline-ai-insights"
        >
          <Sparkles className={cn("h-4 w-4 text-purple-600 mt-0.5 shrink-0", isEnhancing && "animate-pulse")} />
          <div className="flex-1">
            {isEnhancing ? (
              <p className="text-xs text-purple-700">
                AI is analyzing your pipeline to provide personalized recommendations...
              </p>
            ) : aiInsights.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-purple-800">AI Insights:</p>
                {aiInsights.map((insight, i) => (
                  <p key={i} className="text-xs text-purple-700">
                    • {insight}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-purple-700">
                Our AI analyzes your pipeline data to identify bottlenecks, stale candidates, and opportunities.
                Complete these actions to improve time-to-hire and candidate experience.
              </p>
            )}
          </div>
        </div>

        {/* Verification summary - shown after reanalyze */}
        {showVerification && verificationSummary && (
          <VerificationSummaryPanel
            summary={verificationSummary}
            onClose={() => setShowVerification(false)}
          />
        )}

        {/* Reanalyze section */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {reanalyzeCheck.allowed ? (
                <span className="text-emerald-600 font-medium">
                  {reanalyzeCheck.reason} - Ready for fresh AI analysis
                </span>
              ) : (
                reanalyzeCheck.reason
              )}
            </div>
            <Button
              onClick={handleReanalyze}
              disabled={!reanalyzeCheck.allowed || isReanalyzing}
              variant={reanalyzeCheck.allowed ? "default" : "outline"}
              size="sm"
              className={cn(
                reanalyzeCheck.allowed &&
                  "bg-purple-600 hover:bg-purple-700 text-white"
              )}
              data-testid="reanalyze-button"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 mr-2",
                  isReanalyzing && "animate-spin"
                )}
              />
              {isReanalyzing ? "AI Analyzing..." : "Reanalyze with AI"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
