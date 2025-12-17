import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiItem = {
  label: string;
  value: string | number;
  hint?: string | undefined;
  secondary?: string | undefined;
  trend?: "up" | "down" | "flat" | undefined;
  trendValue?: string | undefined; // e.g., "+12%"
};

interface RecruiterKpiRibbonProps {
  items: KpiItem[];
  heroLabel?: string | undefined;
  heroTooltip?: string | undefined;
  className?: string | undefined;
}

const trendConfig = {
  up: { icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
  down: { icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
  flat: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted/50" },
};

export function RecruiterKpiRibbon({ items, heroLabel, heroTooltip, className }: RecruiterKpiRibbonProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3", className)}>
      {items.map((item, idx) => {
        const trend = item.trend ? trendConfig[item.trend] : null;
        const TrendIcon = trend?.icon;

        return (
          <Card
            key={idx}
            className={cn(
              "shadow-sm border-border transition-shadow hover:shadow-md",
              heroLabel === item.label && "border-primary/30 bg-primary/10/50"
            )}
          >
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </CardTitle>
                {heroLabel === item.label && heroTooltip && (
                  <span
                    className="text-[10px] text-primary bg-white/70 border border-primary/30 rounded-full px-2 py-[1px] cursor-help"
                    title={heroTooltip}
                  >
                    ?
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-end justify-between gap-2">
                <div className="text-2xl font-bold text-foreground tabular-nums">{item.value}</div>
                {trend && TrendIcon && (
                  <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium", trend.bg, trend.color)}>
                    <TrendIcon className="h-3 w-3" />
                    {item.trendValue && <span>{item.trendValue}</span>}
                  </div>
                )}
              </div>
              {item.hint && <p className="text-xs text-primary font-medium mt-1">{item.hint}</p>}
              {item.secondary && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{item.secondary}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
