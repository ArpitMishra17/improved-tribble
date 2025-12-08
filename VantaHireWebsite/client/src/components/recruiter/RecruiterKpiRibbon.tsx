import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiItem = {
  label: string;
  value: string | number;
  hint?: string;
};

interface RecruiterKpiRibbonProps {
  items: KpiItem[];
  heroLabel?: string;
  heroTooltip?: string;
  className?: string;
}

export function RecruiterKpiRibbon({ items, heroLabel, heroTooltip, className }: RecruiterKpiRibbonProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3", className)}>
      {items.map((item, idx) => (
        <Card
          key={idx}
          className={cn(
            "shadow-sm border-slate-200",
            heroLabel === item.label && "border-purple-200 bg-purple-50/50"
          )}
        >
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-2">
                {item.label}
              </CardTitle>
              {heroLabel === item.label && heroTooltip && (
                <span
                  className="text-[11px] text-purple-700 bg-white/70 border border-purple-200 rounded-full px-2 py-[2px]"
                  title={heroTooltip}
                >
                  ?
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-slate-900">{item.value}</div>
            {item.hint && <p className="text-xs text-slate-500 mt-1">{item.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
