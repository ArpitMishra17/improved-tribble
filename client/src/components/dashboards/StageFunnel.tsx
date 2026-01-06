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

export function StageFunnel({ title, description, data, isLoading, onStageClick }: StageFunnelProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = data.reduce((max, d) => Math.max(max, d.count), 0);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-[220px] rounded-lg bg-slate-100 animate-pulse" />
        ) : data.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
            No data available
          </div>
        ) : (
          <TooltipProvider>
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(148,163,184,0.25)]">
              <div className="flex h-24 md:h-28">
                {data.map((stage) => {
                  const percent = total > 0 ? (stage.count / total) * 100 : 0;
                  const isLargest = stage.count === maxCount && maxCount > 0;
                  const flexValue = stage.count === 0 ? 0.4 : Math.max(percent / 10, 0.6);

                  return (
                    <Tooltip key={stage.name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "relative flex flex-col justify-center items-center gap-1 text-center text-xs md:text-sm px-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400",
                            "border-r border-slate-200 last:border-r-0",
                            "hover:bg-slate-50",
                            isLargest ? "bg-slate-50" : "bg-white"
                          )}
                          style={{
                            flex: `${flexValue} 1 0`,
                            color: stage.color || "#0f172a",
                            backgroundColor: stage.color ? `${stage.color}22` : undefined,
                          }}
                          onClick={() => onStageClick?.(stage)}
                        >
                          <div className="font-semibold text-slate-900">{stage.name}</div>
                          <div className="text-slate-600">{stage.count}</div>
                          <div className="text-slate-500 text-[11px]">{percent.toFixed(1)}%</div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm">
                        <div className="font-semibold text-slate-900">{stage.name}</div>
                        <div className="text-slate-700">
                          {stage.count} candidates · {percent.toFixed(1)}% of total
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </TooltipProvider>
        )}
        <p className="text-xs text-slate-500">Click a stage to view candidates in that stage.</p>
      </CardContent>
    </Card>
  );
}
