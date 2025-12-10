import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StageSegment = {
  name: string;
  count: number;
  color?: string;
  stageId?: number;
};

interface StageFunnelProps {
  title: string;
  description?: string;
  data: StageSegment[];
  isLoading?: boolean;
  onStageClick?: (stage: StageSegment) => void;
}

// Funnel color gradient from wide (top) to narrow (bottom)
const FUNNEL_COLORS = [
  { bg: "#7B38FB", text: "#ffffff" }, // Purple - Applied
  { bg: "#8B5CF6", text: "#ffffff" }, // Violet - Screening
  { bg: "#A78BFA", text: "#ffffff" }, // Light violet - Interview
  { bg: "#C4B5FD", text: "#1f2937" }, // Lavender - Offer
  { bg: "#10B981", text: "#ffffff" }, // Green - Hired
  { bg: "#EF4444", text: "#ffffff" }, // Red - Rejected
];

export function StageFunnel({ title, description, data, isLoading, onStageClick }: StageFunnelProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Calculate funnel widths - each stage narrows proportionally
  const calculateWidth = (index: number, count: number) => {
    // Base width starts at 100% and decreases
    const baseWidth = 100 - (index * 8); // Each level 8% narrower
    // Adjust by actual data proportion for visual impact
    const dataFactor = count > 0 ? Math.max(0.4, count / maxCount) : 0.3;
    return Math.max(baseWidth * dataFactor, 25); // Min 25% width
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-900">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[320px] rounded-lg bg-slate-100 animate-pulse" />
        ) : data.length === 0 ? (
          <div className="h-[320px] flex items-center justify-center text-slate-500 text-sm">
            No data available
          </div>
        ) : (
          <TooltipProvider>
            <div className="relative flex flex-col items-center py-4 space-y-1">
              {data.map((stage, index) => {
                const percent = total > 0 ? (stage.count / total) * 100 : 0;
                const width = calculateWidth(index, stage.count);
                const fallbackColors = FUNNEL_COLORS[index % FUNNEL_COLORS.length] || { bg: "#475569", text: "#ffffff" };
                const colors = stage.color
                  ? { bg: stage.color, text: "#ffffff" }
                  : fallbackColors;

                return (
                  <Tooltip key={stage.name}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onStageClick?.(stage)}
                        className={cn(
                          "relative group transition-all duration-300 ease-out",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-purple-500",
                          "hover:scale-[1.02] hover:shadow-lg"
                        )}
                        style={{ width: `${width}%` }}
                      >
                        {/* Funnel segment with trapezoid shape */}
                        <div
                          className={cn(
                            "relative py-3 px-4 rounded-sm transition-all duration-200",
                            "flex items-center justify-between gap-2",
                            "shadow-sm hover:shadow-md"
                          )}
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            clipPath: index < data.length - 1
                              ? "polygon(2% 0%, 98% 0%, 100% 100%, 0% 100%)"
                              : "polygon(5% 0%, 95% 0%, 90% 100%, 10% 100%)",
                          }}
                        >
                          {/* Stage name */}
                          <span className="font-medium text-sm truncate">
                            {stage.name}
                          </span>

                          {/* Count and percentage */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-lg tabular-nums">
                              {stage.count}
                            </span>
                            <span
                              className="text-xs opacity-80 tabular-nums"
                              style={{ color: colors.text }}
                            >
                              {percent.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Connector line to next segment */}
                        {index < data.length - 1 && (
                          <div
                            className="absolute left-1/2 -translate-x-1/2 w-0.5 h-1 -bottom-1"
                            style={{ backgroundColor: colors.bg, opacity: 0.4 }}
                          />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="bg-slate-900 text-white border-slate-800"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">{stage.name}</div>
                        <div className="text-slate-300 text-sm">
                          {stage.count} candidates
                        </div>
                        <div className="text-slate-400 text-xs">
                          {percent.toFixed(1)}% of total pipeline
                        </div>
                        <div className="text-purple-400 text-xs pt-1">
                          Click to filter applications
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Funnel total at bottom */}
              <div className="pt-4 text-center">
                <div className="text-2xl font-bold text-slate-900">{total}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  Total Candidates
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
        <p className="text-xs text-slate-500 text-center mt-2">
          Click any stage to view candidates
        </p>
      </CardContent>
    </Card>
  );
}
