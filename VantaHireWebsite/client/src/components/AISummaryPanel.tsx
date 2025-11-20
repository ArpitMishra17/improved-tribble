import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, RefreshCw, CheckCircle, AlertCircle, XCircle, Zap } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PipelineStage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface AISummaryPanelProps {
  applicationId: number;
  jobId: number;
  aiSummary?: string | null;
  aiSuggestedAction?: string | null;
  aiSuggestedActionReason?: string | null;
  aiSummaryComputedAt?: Date | string | null;
  pipelineStages?: PipelineStage[];
  currentStageId?: number | null;
  onMoveStage?: (stageId: number, notes?: string) => void;
  onAddNote?: (note: string) => void;
  onUpdateStatus?: ((status: string, notes?: string) => void) | undefined;
}

interface AISummaryResult {
  message: string;
  summary: {
    text: string;
    suggestedAction: 'advance' | 'hold' | 'reject';
    suggestedActionReason: string;
    strengths: string[];
    concerns: string[];
    keyHighlights: string[];
    modelVersion: string;
    computedAt: Date;
    cost: number;
    durationMs: number;
  };
}

export function AISummaryPanel({
  applicationId,
  jobId,
  aiSummary,
  aiSuggestedAction,
  aiSuggestedActionReason,
  aiSummaryComputedAt,
  pipelineStages,
  currentStageId,
  onMoveStage,
  onAddNote,
  onUpdateStatus,
}: AISummaryPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedSummary, setExpandedSummary] = useState<AISummaryResult['summary'] | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const generateSummaryMutation = useMutation<AISummaryResult, Error>({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/ai-summary`);
      return await res.json();
    },
    onSuccess: (data) => {
      // Expand the detailed summary
      setExpandedSummary(data.summary);

      // Invalidate and refetch application data
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });

      toast({
        title: "AI Summary Generated",
        description: `Summary generated successfully in ${(data.summary.durationMs / 1000).toFixed(1)}s`,
      });
    },
    onError: (error: Error) => {
      const is429 = error.message.includes("429");
      toast({
        title: is429 ? "AI limit reached" : "Generation failed",
        description: is429
          ? "You've reached today's AI summary limit. Please try again tomorrow."
          : error.message,
        variant: "destructive",
      });
    },
  });

  const getActionBadge = (action: string | null | undefined) => {
    switch (action) {
      case 'advance':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Advance
          </Badge>
        );
      case 'hold':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            Hold
          </Badge>
        );
      case 'reject':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Reject
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleApplySuggestion = () => {
    const action = expandedSummary?.suggestedAction || aiSuggestedAction;
    const reason = expandedSummary?.suggestedActionReason || aiSuggestedActionReason || "";

    if (!action) {
      toast({
        title: "No suggestion available",
        description: "Generate an AI summary first to get recommendations.",
        variant: "destructive",
      });
      return;
    }

    if (action === 'advance') {
      // Move to next stage
      if (!pipelineStages || !onMoveStage) {
        toast({
          title: "Cannot apply suggestion",
          description: "Stage management is not available in this context.",
          variant: "destructive",
        });
        return;
      }

      // Find the next stage
      const sortedStages = [...pipelineStages].sort((a, b) => a.order - b.order);
      const currentIndex = sortedStages.findIndex(s => s.id === currentStageId);
      const nextStage = currentIndex >= 0 && currentIndex < sortedStages.length - 1
        ? sortedStages[currentIndex + 1]
        : sortedStages[0]; // If no current stage or at end, use first stage

      if (!nextStage) {
        toast({
          title: "No next stage",
          description: "Cannot advance: no pipeline stages configured.",
          variant: "destructive",
        });
        return;
      }

      onMoveStage(nextStage.id, `AI recommendation: ${reason}`);
      toast({
        title: "Candidate advanced",
        description: `Moved to "${nextStage.name}"`,
      });
    } else if (action === 'reject') {
      // Update status to rejected
      if (!onUpdateStatus) {
        toast({
          title: "Cannot apply suggestion",
          description: "Status update is not available in this context.",
          variant: "destructive",
        });
        return;
      }

      onUpdateStatus('rejected', `AI recommendation: ${reason}`);
      toast({
        title: "Candidate rejected",
        description: "Status updated to rejected based on AI recommendation.",
      });
    } else if (action === 'hold') {
      // Add a note about holding
      if (!onAddNote) {
        toast({
          title: "Cannot apply suggestion",
          description: "Note adding is not available in this context.",
          variant: "destructive",
        });
        return;
      }

      onAddNote(`AI recommended hold: ${reason}`);
      toast({
        title: "Hold note added",
        description: "Added AI recommendation to notes.",
      });
    }

    setShowConfirmDialog(false);
  };

  const hasSummary = aiSummary || expandedSummary;
  const suggestedAction = expandedSummary?.suggestedAction || aiSuggestedAction;
  const canApplySuggestion = suggestedAction && (
    (suggestedAction === 'advance' && pipelineStages && onMoveStage) ||
    (suggestedAction === 'reject' && onUpdateStatus) ||
    (suggestedAction === 'hold' && onAddNote)
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <CardTitle>AI Candidate Summary</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateSummaryMutation.mutate()}
            disabled={generateSummaryMutation.isPending}
          >
            {generateSummaryMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : hasSummary ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Summary
              </>
            )}
          </Button>
        </div>
        {aiSummaryComputedAt && (
          <CardDescription>
            Last generated: {new Date(aiSummaryComputedAt).toLocaleString()}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {hasSummary ? (
          <>
            {/* Suggested Action */}
            {(aiSuggestedAction || expandedSummary?.suggestedAction) && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">Recommendation:</span>
                  {getActionBadge(expandedSummary?.suggestedAction || aiSuggestedAction)}
                </div>
                <p className="text-sm text-slate-600">
                  {expandedSummary?.suggestedActionReason || aiSuggestedActionReason}
                </p>
                {canApplySuggestion && (
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    variant="outline"
                    size="sm"
                    className="w-full border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Apply Suggestion
                  </Button>
                )}
              </div>
            )}

            {/* Summary Text */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-700">Summary</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {expandedSummary?.text || aiSummary}
              </p>
            </div>

            {/* Strengths */}
            {expandedSummary?.strengths && expandedSummary.strengths.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">Key Strengths</h4>
                <ul className="list-disc list-inside space-y-1">
                  {expandedSummary.strengths.map((strength, idx) => (
                    <li key={idx} className="text-sm text-slate-600">
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {expandedSummary?.concerns && expandedSummary.concerns.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">Areas of Concern</h4>
                <ul className="list-disc list-inside space-y-1">
                  {expandedSummary.concerns.map((concern, idx) => (
                    <li key={idx} className="text-sm text-slate-600">
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Highlights */}
            {expandedSummary?.keyHighlights && expandedSummary.keyHighlights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">Notable Achievements</h4>
                <ul className="list-disc list-inside space-y-1">
                  {expandedSummary.keyHighlights.map((highlight, idx) => (
                    <li key={idx} className="text-sm text-slate-600">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No AI summary generated yet.</p>
            <p className="text-xs mt-1">Click "Generate Summary" to get AI-powered insights.</p>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply AI Recommendation?</DialogTitle>
            <DialogDescription>
              This will apply the AI's suggested action to this candidate.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Action:</span>
              {getActionBadge(suggestedAction)}
            </div>
            <p className="text-sm text-slate-600">
              {expandedSummary?.suggestedActionReason || aiSuggestedActionReason}
            </p>
            {suggestedAction === 'advance' && pipelineStages && (
              <p className="text-sm text-slate-500 mt-3">
                This will move the candidate to the next pipeline stage.
              </p>
            )}
            {suggestedAction === 'reject' && (
              <p className="text-sm text-slate-500 mt-3">
                This will update the candidate's status to "rejected".
              </p>
            )}
            {suggestedAction === 'hold' && (
              <p className="text-sm text-slate-500 mt-3">
                This will add a note explaining the hold recommendation.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplySuggestion}
              className="bg-primary hover:bg-primary/90"
            >
              <Zap className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
