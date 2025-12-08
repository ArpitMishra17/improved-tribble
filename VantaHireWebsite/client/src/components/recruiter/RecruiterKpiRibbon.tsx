import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiItem = {
  label: string;
  value: string | number;
  hint?: string;
};

interface RecruiterKpiRibbonProps {
  items: KpiItem[];
  className?: string;
}

export function RecruiterKpiRibbon({ items, className }: RecruiterKpiRibbonProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3", className)}>
      {items.map((item, idx) => (
        <Card key={idx} className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-slate-500">{item.label}</CardTitle>
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
