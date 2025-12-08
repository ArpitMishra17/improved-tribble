import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, isRateLimitError, RateLimitError } from "@/lib/queryClient";
import {
  Brain,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Target,
  Users,
  Search,
  Clock,
  Sparkles,
  DollarSign,
  RotateCcw,
  AlertCircle
} from "lucide-react";

interface AnalysisResult {
  clarity_score: number;
  inclusion_score: number;
  seo_score: number;
  overall_score: number;
  bias_flags: string[];
  seo_keywords: string[];
  suggestions: string[];
  model_version: string;
  analysis_timestamp: string;
  cost?: number;
  durationMs?: number;
}

interface AIAnalysisPanelProps {
  title: string;
  description: string;
  onAnalysisComplete?: (result: AnalysisResult) => void;
  disabled?: boolean;
}

export default function AIAnalysisPanel({ 
  title, 
  description, 
  onAnalysisComplete,
  disabled = false 
}: AIAnalysisPanelProps) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze-job-description", {
        title,
        description
      });
      return res.json();
    },
    onSuccess: (result: AnalysisResult) => {
      setAnalysisResult(result);
      onAnalysisComplete?.(result);
      toast({
        title: "Analysis Complete",
        description: "AI has analyzed your job description and provided recommendations.",
      });
    },
    onError: (error: Error) => {
      const is429 = isRateLimitError(error);
      const rateLimitErr = error as RateLimitError;
      const remainingInfo = is429 && rateLimitErr.formattedRemaining ? ` (${rateLimitErr.formattedRemaining})` : '';
      toast({
        title: is429 ? "AI limit reached" : "Analysis Failed",
        description: is429
          ? `You've reached today's AI analysis limit${remainingInfo}. Try again ${rateLimitErr.formattedRetryTime}.`
          : error.message || "Unable to analyze job description at this time.",
        variant: "destructive",
      });
    },
  });

  // Format cost for display
  const formatCost = (cost: number) => {
    if (cost < 0.01) return "<$0.01";
    return `$${cost.toFixed(3)}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreDescription = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Very Good";
    if (score >= 70) return "Good";
    if (score >= 60) return "Fair";
    return "Needs Improvement";
  };

  const ScoreRing = ({ score, label, icon: Icon }: { score: number; label: string; icon: any }) => (
    <div className="flex flex-col items-center p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div className="relative w-16 h-16 mb-2">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-200"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
            className={getScoreColor(score)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-6 h-6 text-slate-600" />
        </div>
      </div>
      <div className="text-center">
        <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score}
        </div>
        <div className="text-sm text-slate-600 mb-1">{label}</div>
        <div className="text-xs text-slate-500">{getScoreDescription(score)}</div>
      </div>
    </div>
  );

  if (!title || !description) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-slate-500">
            <Brain className="w-5 h-5" />
            <span>Add job title and description to enable AI analysis</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-slate-900">
          <Sparkles className="w-5 h-5 text-primary" />
          <span>AI Job Analysis</span>
        </CardTitle>
        <CardDescription className="text-slate-500">
          Get intelligent insights to optimize your job posting for better performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!analysisResult && analysisMutation.isError ? (
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-300" />
            <p className="text-sm text-red-600 font-medium">Analysis failed</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              {isRateLimitError(analysisMutation.error)
                ? `Daily AI limit reached. Try again ${(analysisMutation.error as RateLimitError).formattedRetryTime}.`
                : analysisMutation.error?.message || "An error occurred"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                analysisMutation.reset();
                analysisMutation.mutate();
              }}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : !analysisResult ? (
          <div className="text-center">
            <Button
              onClick={() => analysisMutation.mutate()}
              disabled={disabled || analysisMutation.isPending}
            >
              {analysisMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Analyze with AI
                </>
              )}
            </Button>
            <p className="text-sm text-slate-500 mt-2">
              AI will evaluate clarity, inclusion, and SEO optimization
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-slate-900">Overall Score</h3>
              </div>
              <div className={`text-4xl font-bold ${getScoreColor(analysisResult.overall_score)}`}>
                {analysisResult.overall_score}/100
              </div>
              <p className="text-sm text-slate-600 mt-1">
                {getScoreDescription(analysisResult.overall_score)}
              </p>
            </div>

            {/* Individual Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ScoreRing 
                score={analysisResult.clarity_score} 
                label="Clarity" 
                icon={CheckCircle}
              />
              <ScoreRing 
                score={analysisResult.inclusion_score} 
                label="Inclusion" 
                icon={Users}
              />
              <ScoreRing 
                score={analysisResult.seo_score} 
                label="SEO" 
                icon={Search}
              />
            </div>

            {/* Bias Flags */}
            {analysisResult.bias_flags.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900">
                  <strong>Bias Detected:</strong> Consider revising these terms: {" "}
                  {analysisResult.bias_flags.map((flag, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="mx-1 border-amber-300 text-amber-700 bg-amber-50"
                    >
                      {flag}
                    </Badge>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* SEO Keywords */}
            {analysisResult.seo_keywords.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center space-x-2 text-slate-900 font-medium">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Recommended SEO Keywords</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.seo_keywords.map((keyword, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-blue-200 text-blue-700 bg-blue-50"
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {analysisResult.suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center space-x-2 text-slate-900 font-medium">
                  <Lightbulb className="w-4 h-4 text-green-600" />
                  <span>AI Recommendations</span>
                </h4>
                <div className="space-y-2">
                  {analysisResult.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-2 p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Info with cost/duration */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-3">
                {analysisResult.durationMs !== undefined && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(analysisResult.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {analysisResult.cost !== undefined && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatCost(analysisResult.cost)}
                  </span>
                )}
              </div>
              <span>Model: {analysisResult.model_version}</span>
            </div>

            {/* Re-analyze Button */}
            <Button
              onClick={() => analysisMutation.mutate()}
              disabled={analysisMutation.isPending}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {analysisMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Re-analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Re-analyze
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}