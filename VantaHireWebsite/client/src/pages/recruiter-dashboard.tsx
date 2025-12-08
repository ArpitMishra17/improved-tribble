import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Users,
  Briefcase,
  Clock,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  Target,
  BarChart3,
  Filter,
  Sparkles,
} from "lucide-react";
import Layout from "@/components/Layout";
import type { Job, Application, PipelineStage } from "@shared/schema";
import { KpiCard } from "@/components/dashboards/KpiCard";
import { TimeSeriesChart } from "@/components/dashboards/TimeSeriesChart";
import { FunnelChart } from "@/components/dashboards/FunnelChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Extended types for API responses with relations
type ApplicationWithJob = Application & {
  job?: { title: string };
};

type JobWithCounts = Job & {
  company?: string;
  applicationCount?: number;
};

type HiringMetrics = {
  timeToFill: {
    overall: number | null;
    byJob: Array<{
      jobId: number;
      jobTitle: string;
      averageDays: number;
      hiredCount: number;
      oldestHireDate: string | null;
      newestHireDate: string | null;
    }>;
  };
  timeInStage: Array<{
    stageId: number;
    stageName: string;
    stageOrder: number;
    averageDays: number;
    transitionCount: number;
    minDays: number;
    maxDays: number;
  }>;
  totalApplications: number;
  totalHires: number;
  conversionRate: number;
};

type JobHealth = {
  jobId: number;
  jobTitle: string;
  isActive: boolean;
  status: "green" | "amber" | "red";
  reason: string;
  totalApplications: number;
  daysSincePosted: number;
  daysSinceLastApplication: number | null;
  conversionRate: number;
};

type AnalyticsNudges = {
  jobsNeedingAttention: JobHealth[];
  staleCandidates: Array<{
    jobId: number;
    jobTitle: string;
    count: number;
    oldestStaleDays: number;
  }>;
};

const RANGE_PRESETS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export default function RecruiterDashboard() {
  const [, setLocation] = useLocation();
  const [rangePreset, setRangePreset] = useState<keyof typeof RANGE_PRESETS>("30d");
  const [selectedJobId, setSelectedJobId] = useState<number | "all">("all");

  // Fetch recruiter's jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<JobWithCounts[]>({
    queryKey: ["/api/my-jobs"],
  });

  // Fetch all applications for recruiter's jobs
  const { data: applications = [], isLoading: applicationsLoading } = useQuery<ApplicationWithJob[]>({
    queryKey: ["/api/my-applications-received"],
  });

  // Fetch pipeline stages
  const { data: pipelineStages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
  });

  const { data: hiringMetrics } = useQuery<HiringMetrics>({
    queryKey: ["/api/analytics/hiring-metrics", rangePreset, selectedJobId],
    queryFn: async () => {
      const params = new URLSearchParams();
      const days = RANGE_PRESETS[rangePreset] ?? 30;
      const end = new Date();
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      params.set("startDate", start.toISOString());
      params.set("endDate", end.toISOString());
      if (selectedJobId !== "all") params.set("jobId", String(selectedJobId));
      const res = await fetch(`/api/analytics/hiring-metrics?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hiring metrics");
      return res.json();
    },
  });

  const { data: jobHealth = [] } = useQuery<JobHealth[]>({
    queryKey: ["/api/analytics/job-health"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/job-health", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job health");
      return res.json();
    },
  });

  const { data: nudges } = useQuery<AnalyticsNudges>({
    queryKey: ["/api/analytics/nudges"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/nudges", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics nudges");
      return res.json();
    },
  });

  const days = RANGE_PRESETS[rangePreset] ?? 30;
  const dateEnd = useMemo(() => new Date(), [rangePreset]);
  const dateStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }, [days]);

  const filteredJobs = useMemo(() => {
    if (selectedJobId === "all") return jobs;
    return jobs.filter((job) => job.id === selectedJobId);
  }, [jobs, selectedJobId]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const appliedAt = new Date(app.appliedAt);
      const withinRange = appliedAt >= dateStart && appliedAt <= dateEnd;
      const matchesJob = selectedJobId === "all" ? true : app.jobId === selectedJobId;
      return withinRange && matchesJob;
    });
  }, [applications, dateStart, dateEnd, selectedJobId]);

  type DropoffResponse = {
    stages: Array<{ stageId: number; name: string; order: number; count: number }>;
    unassigned: number;
    conversions: Array<{ name: string; count: number; rate: number }>;
  };

  type SourcePerfRow = {
    source: string;
    apps: number;
    shortlist: number;
    hires: number;
    conversion: number;
  };

  type HmFeedbackResponse = {
    averageDays: number | null;
    waitingCount: number;
    sampleSize: number;
  };

  const commonParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("startDate", dateStart.toISOString());
    params.set("endDate", dateEnd.toISOString());
    if (selectedJobId !== "all") params.set("jobId", String(selectedJobId));
    return params.toString();
  }, [dateStart, dateEnd, selectedJobId]);

  const { data: dropoffData } = useQuery<DropoffResponse>({
    queryKey: ["/api/analytics/dropoff", commonParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/dropoff?${commonParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dropoff analytics");
      return res.json();
    },
  });

  const { data: sourcePerfData } = useQuery<SourcePerfRow[]>({
    queryKey: ["/api/analytics/source-performance", commonParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/source-performance?${commonParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch source performance");
      return res.json();
    },
  });

  // Derive default review/next stages for HM feedback analytics
  const reviewStageIds = useMemo(
    () =>
      pipelineStages
        .filter((s) => s.name.toLowerCase().includes("review"))
        .map((s) => s.id),
    [pipelineStages]
  );
  const nextStageIds = useMemo(
    () =>
      pipelineStages
        .filter((s) => {
          const name = s.name.toLowerCase();
          return name.includes("interview") || name.includes("offer");
        })
        .map((s) => s.id),
    [pipelineStages]
  );
  const { data: hmFeedback } = useQuery<HmFeedbackResponse>({
    queryKey: ["/api/analytics/hm-feedback", commonParams, reviewStageIds, nextStageIds],
    queryFn: async () => {
      const params = new URLSearchParams(commonParams);
      if (reviewStageIds.length) {
        reviewStageIds.forEach((id) => params.append("reviewStageIds", String(id)));
      }
      if (nextStageIds.length) {
        nextStageIds.forEach((id) => params.append("nextStageIds", String(id)));
      }
      const res = await fetch(`/api/analytics/hm-feedback?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch HM feedback timing");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    const totalJobs = filteredJobs.length;
    const activeJobs = filteredJobs.filter((job) => job.isActive).length;
    const totalApplications = filteredApplications.length;
    const totalHires =
      hiringMetrics?.totalHires ??
      filteredApplications.filter(
        (app) =>
          app.status === "hired" ||
          pipelineStages.find((s) => s.id === app.currentStage)?.name?.toLowerCase().includes("hire")
      ).length;
    const conversionRate =
      totalApplications > 0 ? Math.round((totalHires / totalApplications) * 1000) / 10 : 0;
    const avgTimeToFill = hiringMetrics?.timeToFill.overall ?? null;
    const hmFeedbackStage = hiringMetrics?.timeInStage.find((stage) =>
      stage.stageName.toLowerCase().includes("review")
    );
    const hmFeedbackTime = hmFeedback?.averageDays ?? hmFeedbackStage?.averageDays ?? null;
    return {
      totalJobs,
      activeJobs,
      totalApplications,
      totalHires,
      conversionRate,
      avgTimeToFill,
      hmFeedbackTime,
    };
  }, [filteredJobs, filteredApplications, hiringMetrics, pipelineStages]);

  const pipelineHealthScore = useMemo(() => {
    if (!jobHealth.length) return { score: 72, tag: "Stable" };
    const weight = { green: 95, amber: 68, red: 40 };
    const avg =
      jobHealth.reduce((sum, j) => sum + (weight[j.status] ?? 70), 0) / jobHealth.length;
    const tag = avg >= 80 ? "Healthy" : avg >= 60 ? "Stable" : "At risk";
    return { score: Math.round(avg), tag };
  }, [jobHealth]);

  const timeSeriesData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const cursor = new Date(dateStart);
    while (cursor <= dateEnd) {
      const key = cursor.toISOString().slice(0, 10);
      buckets[key] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    filteredApplications.forEach((app) => {
      const dateKey = new Date(app.appliedAt).toISOString().slice(0, 10);
      if (buckets[dateKey] !== undefined) buckets[dateKey] += 1;
    });
    return Object.entries(buckets)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredApplications, dateStart, dateEnd]);

  const funnelData = useMemo(() => {
    if (dropoffData) {
      const sorted = [...dropoffData.stages].sort((a, b) => b.count - a.count);
      const unassigned = dropoffData.unassigned
        ? [{ name: "Unassigned", count: dropoffData.unassigned, color: "#94a3b8", order: -1 }]
        : [];
      return [...unassigned, ...sorted.map((s) => ({ name: s.name, count: s.count, color: "#64748b" }))];
    }
    // Fallback to client-side derivation
    const counts: Record<string, number> = {};
    filteredApplications.forEach((app) => {
      const key = app.currentStage ? String(app.currentStage) : "unassigned";
      counts[key] = (counts[key] || 0) + 1;
    });
    const sortedStages = [...pipelineStages].sort((a, b) => a.order - b.order);
    const mapped = sortedStages.map((stage) => ({
      name: stage.name,
      count: counts[String(stage.id)] || 0,
      color: stage.color || "#64748b",
      order: stage.order,
    }));
    const unassigned = counts["unassigned"]
      ? [{ name: "Unassigned", count: counts["unassigned"], color: "#94a3b8", order: -1 }]
      : [];
    return [...unassigned, ...mapped].sort((a, b) => b.count - a.count);
  }, [dropoffData, filteredApplications, pipelineStages]);

  const dropoffInsights = useMemo(() => {
    if (dropoffData?.conversions) {
      const weakest = [...dropoffData.conversions]
        .filter((c) => c.rate !== 100)
        .sort((a, b) => a.rate - b.rate)[0];
      return { conversions: dropoffData.conversions, weakest };
    }
    const sortedStages = [...pipelineStages].sort((a, b) => a.order - b.order);
    const counts = sortedStages.map((stage) => ({
      name: stage.name,
      count: filteredApplications.filter((app) => app.currentStage === stage.id).length,
    }));
    const conversions = counts.map((stage, idx) => {
      if (idx === 0) return { ...stage, rate: 100 };
      const prev = counts[idx - 1]?.count || 0;
      const rate = prev > 0 ? Math.round((stage.count / prev) * 100) : 0;
      return { ...stage, rate };
    });
    const lowest = conversions
      .filter((c) => c.name && c.rate !== 100)
      .sort((a, b) => a.rate - b.rate)[0];
    return { conversions, weakest: lowest };
  }, [dropoffData, filteredApplications, pipelineStages]);

  const jobsNeedingAttention = useMemo(() => {
    if (nudges?.jobsNeedingAttention?.length) {
      return [...nudges.jobsNeedingAttention].sort((a, b) => {
        const weight = { red: 2, amber: 1, green: 0 } as const;
        return (weight[b.status] ?? 0) - (weight[a.status] ?? 0);
      });
    }
    return [...jobHealth].sort((a, b) => (a.status === "red" ? -1 : b.status === "red" ? 1 : 0));
  }, [nudges, jobHealth]);

  const jdSuggestions = useMemo(() => {
    const suggestions: Array<{
      jobId: number;
      title: string;
      score: string;
      tips: string[];
    }> = [];
    filteredJobs.forEach((job) => {
      const tips: string[] = [];
      const descriptionLength = job.description?.length || 0;
      if (!job.location) tips.push("Add a location or remote policy to increase clarity.");
      if (descriptionLength < 400) tips.push("Expand responsibilities and success criteria (JD is very short).");
      if ((job.skills || []).length < 3) tips.push("List 3–5 must-have skills to improve screening.");
      if (descriptionLength > 2000) tips.push("Break long paragraphs into bullets for readability.");
      if (tips.length > 0) {
        const score = tips.length >= 3 ? "Needs improvement" : "Moderate";
        suggestions.push({ jobId: job.id, title: job.title, score, tips });
      }
    });
    return suggestions;
  }, [filteredJobs]);

  const sourcePerformance = useMemo(() => {
    if (sourcePerfData) return sourcePerfData;
    const grouped: Record<string, { apps: number; shortlist: number; hires: number }> = {};
    filteredApplications.forEach((app) => {
      const key = app.source || "unknown";
      if (!grouped[key]) grouped[key] = { apps: 0, shortlist: 0, hires: 0 };
      grouped[key].apps += 1;
      if (app.status === "shortlisted" || app.status === "interview") grouped[key].shortlist += 1;
      if (app.status === "hired") grouped[key].hires += 1;
    });
    return Object.entries(grouped).map(([source, metrics]) => ({
      source,
      apps: metrics.apps,
      shortlist: metrics.shortlist,
      hires: metrics.hires,
      conversion: metrics.apps > 0 ? Math.round((metrics.hires / metrics.apps) * 1000) / 10 : 0,
    }));
  }, [sourcePerfData, filteredApplications]);

  const candidateFit = useMemo(() => {
    const buckets: Record<string, number> = {};
    filteredApplications.forEach((app) => {
      const label = app.aiFitLabel || "Unscored";
      buckets[label] = (buckets[label] || 0) + 1;
    });
    const total = filteredApplications.length || 1;
    return Object.entries(buckets).map(([label, count]) => ({
      label,
      count,
      percent: Math.round((count / total) * 100),
    }));
  }, [filteredApplications]);

  const aiSummaryText = useMemo(() => {
    const amber = jobHealth.filter((j) => j.status === "amber").length;
    const red = jobHealth.filter((j) => j.status === "red").length;
    const weakestDrop = dropoffInsights.weakest;
    if (red > 0) {
      return `Pipeline risk: ${red} job(s) are red and need movement. ${
        weakestDrop ? `${weakestDrop.name} conversion is ${weakestDrop.rate}%` : ""
      }`;
    }
    if (amber > 0) {
      return `Stable but watchlist: ${amber} job(s) flagged. ${
        weakestDrop ? `${weakestDrop.name} conversion is ${weakestDrop.rate}%` : ""
      }`;
    }
    return weakestDrop
      ? `Pipeline is healthy. Watch ${weakestDrop.name} conversion (${weakestDrop.rate}%).`
      : "Pipeline is healthy. No major bottlenecks detected.";
  }, [jobHealth, dropoffInsights]);

  if (jobsLoading || applicationsLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-600">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2 pt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Recruiter Dashboard</h1>
                <p className="text-slate-500 text-sm md:text-base">
                  Overview of jobs, applications, and hiring performance
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={rangePreset} onValueChange={(val) => setRangePreset(val as keyof typeof RANGE_PRESETS)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={selectedJobId === "all" ? "all" : String(selectedJobId)}
                  onValueChange={(val) => setSelectedJobId(val === "all" ? "all" : Number(val))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All jobs</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={String(job.id)}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard
              label="AI Pipeline Health"
              value={`${pipelineHealthScore.score} (${pipelineHealthScore.tag})`}
              icon={Sparkles}
              isLoading={jobsLoading}
            />
            <KpiCard label="Total Jobs" value={stats.totalJobs} icon={Briefcase} isLoading={jobsLoading} />
            <KpiCard label="Active Jobs" value={stats.activeJobs} icon={CheckCircle} isLoading={jobsLoading} />
            <KpiCard
              label="Total Applications"
              value={stats.totalApplications}
              icon={Users}
              isLoading={applicationsLoading}
            />
            <KpiCard
              label="Total Hires"
              value={`${stats.totalHires} (${stats.conversionRate}% conv)`}
              icon={Target}
              isLoading={applicationsLoading}
            />
            <KpiCard
              label="Avg Time to Fill"
              value={stats.avgTimeToFill ? `${stats.avgTimeToFill}d` : "—"}
              icon={Clock}
              isLoading={!hiringMetrics}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeSeriesChart
              title="Applications Over Time"
              description={`Last ${RANGE_PRESETS[rangePreset]} days`}
              data={timeSeriesData}
              isLoading={applicationsLoading}
            />
            <FunnelChart
              title="Stage Distribution"
              description="Applications by pipeline stage"
              data={funnelData}
              isLoading={applicationsLoading || stagesLoading}
            />
          </div>

          {/* AI Insights */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-lg">AI Insights</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                Grounded in ATS data only
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 border border-slate-200">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-800">{aiSummaryText}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Signals: application velocity, stage conversion, job health.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Jobs Needing Attention
                    </CardTitle>
                    <CardDescription>Sorted by severity</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead>Bottleneck</TableHead>
                          <TableHead className="text-right">Stage count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobsNeedingAttention.slice(0, 5).map((job) => (
                          <TableRow key={job.jobId}>
                            <TableCell className="space-y-1">
                              <div className="font-medium text-slate-900">{job.jobTitle}</div>
                              <Badge
                                variant="outline"
                                className={
                                  job.status === "red"
                                    ? "border-red-200 text-red-700 bg-red-50"
                                    : job.status === "amber"
                                      ? "border-amber-200 text-amber-700 bg-amber-50"
                                      : "border-green-200 text-green-700 bg-green-50"
                                }
                              >
                                {job.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {job.reason || "Needs movement"}
                            </TableCell>
                            <TableCell className="text-right text-sm text-slate-700">
                              {job.totalApplications ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {jobsNeedingAttention.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-4">
                              No risk indicators right now.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      Drop-off Analysis
                    </CardTitle>
                    <CardDescription>Conversion by stage (current pipeline)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {dropoffInsights.conversions.map((stage) => (
                        <div key={stage.name} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">{stage.name}</span>
                          <span className="font-semibold text-slate-900">{stage.rate}%</span>
                        </div>
                      ))}
                    </div>
                    {dropoffInsights.weakest && (
                      <div className="rounded-md bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                        Conversion from previous stage into <strong>{dropoffInsights.weakest.name}</strong> is{" "}
                        {dropoffInsights.weakest.rate}% — consider refining screening or follow-ups.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-600" />
                    JD Clarity Suggestions
                  </CardTitle>
                  <CardDescription>Grounded in JD length, location, and skills coverage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {jdSuggestions.length === 0 && (
                    <p className="text-sm text-slate-500">No JD clarity flags detected for the selected filters.</p>
                  )}
                  {jdSuggestions.map((item) => (
                    <div
                      key={item.jobId}
                      className="rounded-lg border border-slate-200 p-4 bg-white shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <Badge variant="outline" className="text-xs">
                          {item.score}
                        </Badge>
                      </div>
                      <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                        {item.tips.map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Hiring efficiency */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Time to Fill by Job
                </CardTitle>
                <CardDescription>Closed roles in range</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Time to Fill</TableHead>
                      <TableHead>Hires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(hiringMetrics?.timeToFill.byJob || []).slice(0, 6).map((row) => (
                      <TableRow key={row.jobId}>
                        <TableCell className="text-sm text-slate-800">{row.jobTitle}</TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {row.averageDays ? `${row.averageDays} days` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{row.hiredCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!hiringMetrics?.timeToFill.byJob || hiringMetrics.timeToFill.byJob.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-4">
                          No closed roles in this range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-700" />
                  Time in Stage Breakdown
                </CardTitle>
                <CardDescription>Average days per stage</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Avg days</TableHead>
                      <TableHead>Transitions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(hiringMetrics?.timeInStage || []).map((row) => (
                      <TableRow key={row.stageId}>
                        <TableCell className="text-sm text-slate-800">{row.stageName}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.averageDays.toFixed(1)}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.transitionCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!hiringMetrics?.timeInStage || hiringMetrics.timeInStage.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-4">
                          No stage transitions in this range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Source + quality */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-700" />
                  Source Performance
                </CardTitle>
                <CardDescription>Applications, shortlist, hires by source</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Apps</TableHead>
                      <TableHead>Shortlist</TableHead>
                      <TableHead>Hires</TableHead>
                      <TableHead>Conv%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourcePerformance.map((row) => (
                      <TableRow key={row.source}>
                        <TableCell className="text-sm text-slate-800">{row.source}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.apps}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.shortlist}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.hires}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.conversion}%</TableCell>
                      </TableRow>
                    ))}
                    {sourcePerformance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-4">
                          No applications in this range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  Candidate Quality
                </CardTitle>
                <CardDescription>Based on AI fit labels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {candidateFit.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{row.label}</span>
                    <span className="font-semibold text-slate-900">
                      {row.count} ({row.percent}%)
                    </span>
                  </div>
                ))}
                {candidateFit.length === 0 && (
                  <p className="text-sm text-slate-500">No AI fit scores yet for this range.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Button
              variant="outline"
              className="h-24 flex items-center justify-between p-6 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => setLocation("/applications")}
            >
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <div className="font-semibold text-slate-900">View All Applications</div>
                  <div className="text-sm text-slate-500">{stats.totalApplications} total applications</div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex items-center justify-between p-6 border-2 hover:border-primary hover:bg-primary/5"
              onClick={() => setLocation("/my-jobs")}
            >
              <div className="flex items-center gap-3">
                <Briefcase className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <div className="font-semibold text-slate-900">Manage My Jobs</div>
                  <div className="text-sm text-slate-500">{stats.totalJobs} job postings</div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
