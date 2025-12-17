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
      <Card className={cn("shadow-sm", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16" />
        </CardContent>
      </Card>
    );
  }

  const deltaIsPositive = delta && delta.value > 0;
  const deltaIsNegative = delta && delta.value < 0;

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          {Icon && (
            <div className="bg-primary/10 p-2 rounded-md">
              <Icon className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {delta && (
              <div className="flex items-center gap-1 mt-1">
                {deltaIsPositive && <TrendingUp className="w-3 h-3 text-success" />}
                {deltaIsNegative && <TrendingDown className="w-3 h-3 text-destructive" />}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs border-0",
                    deltaIsPositive && "bg-success/10 text-success-foreground",
                    deltaIsNegative && "bg-destructive/10 text-destructive",
                    !deltaIsPositive && !deltaIsNegative && "bg-muted text-muted-foreground"
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
