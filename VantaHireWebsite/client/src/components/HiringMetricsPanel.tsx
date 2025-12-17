import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Clock,
  TrendingUp,
  Users,
  Target,
  Calendar,
  BarChart3,
  Filter,
  X,
  AlertCircle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TimeToFillMetric {
  jobId: number;
  jobTitle: string;
  averageDays: number;
  hiredCount: number;
  oldestHireDate: string | null;
  newestHireDate: string | null;
}

interface TimeInStageMetric {
  stageId: number;
  stageName: string;
  stageOrder: number;
  averageDays: number;
  transitionCount: number;
  minDays: number;
  maxDays: number;
}

interface HiringMetrics {
  timeToFill: {
    overall: number | null;
    byJob: TimeToFillMetric[];
  };
  timeInStage: TimeInStageMetric[];
  totalApplications: number;
  totalHires: number;
  conversionRate: number;
}

interface JobHealthSummary {
  jobId: number;
  jobTitle: string;
  isActive: boolean;
  status: "green" | "amber" | "red";
  reason: string;
  totalApplications: number;
  daysSincePosted: number;
  daysSinceLastApplication: number | null;
  conversionRate: number;
}

interface StaleCandidatesSummary {
  jobId: number;
  jobTitle: string;
  count: number;
  oldestStaleDays: number;
}

interface AnalyticsNudges {
  jobsNeedingAttention: JobHealthSummary[];
  staleCandidates: StaleCandidatesSummary[];
}

interface HiringMetricsPanelProps {
  jobId?: number; // Optional: Filter by specific job
}

export function HiringMetricsPanel({ jobId }: HiringMetricsPanelProps) {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append("startDate", startDate);
  if (endDate) queryParams.append("endDate", endDate);
  if (jobId) queryParams.append("jobId", jobId.toString());

  const queryString = queryParams.toString();

  const { data: metrics, isLoading } = useQuery<HiringMetrics>({
    queryKey: ["/api/analytics/hiring-metrics", queryString],
    queryFn: async () => {
      const url = `/api/analytics/hiring-metrics${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch hiring metrics");
      return response.json();
    },
  });

  const { data: nudges } = useQuery<AnalyticsNudges>({
    queryKey: ["/api/analytics/nudges"],
    queryFn: async () => {
      const response = await fetch("/api/analytics/nudges", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch analytics nudges");
      return response.json();
    },
    enabled: !jobId,
  });

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = startDate || endDate;

  const getHealthBadgeClasses = (status: JobHealthSummary["status"]) => {
    switch (status) {
      case "green":
        return "bg-success/10 text-success-foreground border-success/30";
      case "amber":
        return "bg-warning/10 text-warning-foreground border-warning/30";
      case "red":
      default:
        return "bg-destructive/10 text-destructive border-destructive/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-info" />
            Hiring Metrics
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track time-to-fill, stage efficiency, and conversion rates
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      {/* Date Range Filters */}
      {showFilters && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date Range Filter
            </CardTitle>
            <CardDescription>
              Filter metrics by date range (applies to hire dates and stage transitions)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white"
                />
              </div>

              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50 animate-spin" />
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
      ) : !metrics ? (
        <Card className="bg-white border-border">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No metrics data available.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Average Time to Fill */}
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Time to Fill
                </CardTitle>
                <Clock className="h-4 w-4 text-info" />
              </CardHeader>
              <CardContent>
                {metrics.timeToFill.overall !== null ? (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {metrics.timeToFill.overall} days
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      From application to hire
                    </p>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No hires yet</div>
                )}
              </CardContent>
            </Card>

            {/* Total Hires */}
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Hires
                </CardTitle>
                <Users className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {metrics.totalHires}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Successful placements
                </p>
              </CardContent>
            </Card>

            {/* Total Applications */}
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Applications
                </CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {metrics.totalApplications}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Candidates reviewed
                </p>
              </CardContent>
            </Card>

            {/* Conversion Rate */}
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conversion Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {metrics.conversionRate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Applications to hires
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Time to Fill by Job */}
          {!jobId && metrics.timeToFill.byJob.length > 0 && (
            <Card className="bg-white border-border">
              <CardHeader>
                <CardTitle className="text-lg">Time to Fill by Job</CardTitle>
                <CardDescription>
                  Average days from application to hire for each role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Title</TableHead>
                      <TableHead className="text-right">Avg Days</TableHead>
                      <TableHead className="text-right">Hires</TableHead>
                      <TableHead className="text-right">Date Range</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.timeToFill.byJob.map((job) => (
                      <TableRow key={job.jobId}>
                        <TableCell className="font-medium">
                          {job.jobTitle}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-info/10 text-info-foreground border-info/30">
                            {job.averageDays} days
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {job.hiredCount}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {job.oldestHireDate && job.newestHireDate ? (
                            <>
                              {new Date(job.oldestHireDate).toLocaleDateString()} -{" "}
                              {new Date(job.newestHireDate).toLocaleDateString()}
                            </>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Time in Stage */}
          {metrics.timeInStage.length > 0 && (
            <Card className="bg-white border-border">
              <CardHeader>
                <CardTitle className="text-lg">Time in Stage Breakdown</CardTitle>
                <CardDescription>
                  Average days candidates spend in each pipeline stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead className="text-right">Avg Days</TableHead>
                      <TableHead className="text-right">Min Days</TableHead>
                      <TableHead className="text-right">Max Days</TableHead>
                      <TableHead className="text-right">Transitions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.timeInStage
                      .filter((stage) => stage.transitionCount > 0)
                      .map((stage) => (
                        <TableRow key={stage.stageId}>
                          <TableCell className="font-medium">
                            {stage.stageName}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={
                                stage.averageDays <= 3
                                  ? "bg-success/10 text-success-foreground border-success/30"
                                  : stage.averageDays <= 7
                                  ? "bg-warning/10 text-warning-foreground border-warning/30"
                                  : "bg-warning/10 text-warning-foreground border-warning/30"
                              }
                            >
                              {stage.averageDays} days
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {stage.minDays}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {stage.maxDays}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {stage.transitionCount}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {metrics.timeInStage.filter((s) => s.transitionCount > 0)
                  .length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No stage transition data available yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attention Needed / Nudges */}
          {!jobId &&
            nudges &&
            (nudges.jobsNeedingAttention.length > 0 ||
              nudges.staleCandidates.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Jobs Needing Attention */}
                <Card className="bg-white border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      Jobs Needing Attention
                    </CardTitle>
                    <CardDescription>
                      Roles with low volume, stale activity, or setup issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {nudges.jobsNeedingAttention.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        All tracked jobs look healthy right now.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {nudges.jobsNeedingAttention.map((job) => (
                          <div
                            key={job.jobId}
                            className="flex items-start justify-between gap-3 p-3 border border-border rounded-md bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm">
                                {job.jobTitle}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {job.reason}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {job.totalApplications} applications •{" "}
                                {job.daysSincePosted} days active
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`${getHealthBadgeClasses(
                                job.status,
                              )} text-xs font-medium`}
                            >
                              {job.status === "green"
                                ? "Healthy"
                                : job.status === "amber"
                                ? "Watch"
                                : "Attention"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Stale Candidates */}
                <Card className="bg-white border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Stale Candidates
                    </CardTitle>
                    <CardDescription>
                      Candidates sitting in the same stage for many days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {nudges.staleCandidates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No stale candidates detected based on current thresholds.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {nudges.staleCandidates.map((item) => (
                          <div
                            key={item.jobId}
                            className="flex items-start justify-between gap-3 p-3 border border-border rounded-md bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground text-sm">
                                {item.jobTitle}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.count} candidate
                                {item.count === 1 ? "" : "s"} waiting on action
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-warning/10 text-warning-foreground border-warning/30 text-xs font-medium"
                            >
                              {item.oldestStaleDays}+ days
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
        </>
      )}
    </div>
  );
}
