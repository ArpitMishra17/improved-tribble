import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  delta?: {
    value: number;
    label: string;
  };
  isLoading?: boolean;
  className?: string;
}

export function KpiCard({ label, value, icon: Icon, delta, isLoading, className }: KpiCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("bg-slate-900 border-slate-700", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24 bg-slate-700" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  const deltaIsPositive = delta && delta.value > 0;
  const deltaIsNegative = delta && delta.value < 0;

  return (
    <Card className={cn("bg-slate-900 border-slate-700", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-400">{label}</CardTitle>
          {Icon && (
            <div className="bg-purple-500/20 p-2 rounded-md">
              <Icon className="w-4 h-4 text-purple-300" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-white">{value}</p>
            {delta && (
              <div className="flex items-center gap-1 mt-1">
                {deltaIsPositive && <TrendingUp className="w-3 h-3 text-green-400" />}
                {deltaIsNegative && <TrendingDown className="w-3 h-3 text-red-400" />}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs border-0",
                    deltaIsPositive && "bg-green-500/20 text-green-300",
                    deltaIsNegative && "bg-red-500/20 text-red-300",
                    !deltaIsPositive && !deltaIsNegative && "bg-slate-500/20 text-slate-300"
                  )}
                >
                  {deltaIsPositive && "+"}
                  {delta.value}
                  {delta.label && ` ${delta.label}`}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
