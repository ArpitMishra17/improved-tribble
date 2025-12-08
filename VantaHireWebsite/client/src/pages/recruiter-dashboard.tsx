import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { RecruiterKpiRibbon } from "@/components/recruiter/RecruiterKpiRibbon";
import { RecruiterAiInsightsSection } from "@/components/recruiter/RecruiterAiInsightsSection";
import { AiPipelineSummary } from "@/components/recruiter/AiPipelineSummary";

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

type DashboardAiInsights = {
  summary: string;
  dropoffExplanation: string;
  jobs: Array<{ jobId: number; nextAction: string }>;
  generatedAt: string;
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

type PerformanceResponse = {
  recruiters: Array<{
    id: number;
    name: string;
    jobsHandled: number;
    candidatesScreened: number;
    avgFirstActionDays: number | null;
    avgStageMoveDays: number | null;
  }>;
  hiringManagers: Array<{
    id: number;
    name: string;
    jobsOwned: number;
    avgFeedbackDays: number | null;
    waitingCount: number;
  }>;
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

  const { data: performance } = useQuery<PerformanceResponse>({
    queryKey: ["/api/analytics/performance", commonParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/performance?${commonParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch performance metrics");
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
    const newToday = filteredApplications.filter((app) => {
      const applied = new Date(app.appliedAt);
      const today = new Date();
      return applied.toDateString() === today.toDateString();
    }).length;

    const firstActionDurations: number[] = [];
    filteredApplications.forEach((app) => {
      if (app.stageChangedAt) {
        const delta = (new Date(app.stageChangedAt).getTime() - new Date(app.appliedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (delta >= 0) firstActionDurations.push(delta);
      }
    });
    const avgFirstReview = firstActionDurations.length
      ? Math.round((firstActionDurations.reduce((a, b) => a + b, 0) / firstActionDurations.length) * 10) / 10
      : null;

    let interviewConv = 0;
    if (dropoffData?.conversions?.length) {
      const interviewStep = dropoffData.conversions.find((c) => c.name.toLowerCase().includes("interview"));
      if (interviewStep) interviewConv = interviewStep.rate;
    } else {
      const screeningIds = pipelineStages.filter((s) => s.name.toLowerCase().includes("screen")).map((s) => s.id);
      const interviewIds = pipelineStages.filter((s) => s.name.toLowerCase().includes("interview")).map((s) => s.id);
      const screeningCount = filteredApplications.filter((a) => a.currentStage && screeningIds.includes(a.currentStage)).length;
      const interviewCount = filteredApplications.filter((a) => a.currentStage && interviewIds.includes(a.currentStage)).length;
      interviewConv = screeningCount > 0 ? Math.round((interviewCount / screeningCount) * 1000) / 10 : 0;
    }

    return {
      totalJobs,
      activeJobs,
      totalApplications,
      totalHires,
      conversionRate,
      avgTimeToFill,
      hmFeedbackTime,
      newToday,
      avgFirstReview,
      interviewConv,
    };
  }, [filteredJobs, filteredApplications, hiringMetrics, pipelineStages, hmFeedback, dropoffData]);

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
      const maxCount = sorted[0]?.count ?? 0;
      const unassigned = dropoffData.unassigned
        ? [{ name: "Unassigned", count: dropoffData.unassigned, color: "#94a3b8", order: -1 }]
        : [];
      return [
        ...unassigned,
        ...sorted.map((s) => ({
          name: s.name,
          count: s.count,
          color: s.count === maxCount ? "#334155" : "#64748b",
        })),
      ];
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

  // Derive trends from time-series (compare last 7 days vs previous 7)
  const appsTrend = useMemo(() => {
    if (timeSeriesData.length < 14) return { trend: "flat" as const, value: "" };
    const recent = timeSeriesData.slice(-7).reduce((s, d) => s + d.value, 0);
    const prior = timeSeriesData.slice(-14, -7).reduce((s, d) => s + d.value, 0);
    if (prior === 0) return { trend: "flat" as const, value: "" };
    const pct = Math.round(((recent - prior) / prior) * 100);
    return {
      trend: pct > 5 ? "up" as const : pct < -5 ? "down" as const : "flat" as const,
      value: pct > 0 ? `+${pct}%` : `${pct}%`,
    };
  }, [timeSeriesData]);

  const kpiItems = useMemo(
    () => [
      {
        label: "Pipeline Health",
        value: `${pipelineHealthScore.score}%`,
        hint: pipelineHealthScore.tag,
        trend: pipelineHealthScore.score >= 70 ? "up" as const : pipelineHealthScore.score >= 50 ? "flat" as const : "down" as const,
      },
      {
        label: "Active Roles",
        value: stats.activeJobs,
        secondary: "Open positions",
      },
      {
        label: "Today's Apps",
        value: stats.newToday ?? 0,
        trend: appsTrend.trend,
        trendValue: appsTrend.value || undefined,
        secondary: "vs last week",
      },
      {
        label: "First Review",
        value: stats.avgFirstReview != null ? `${stats.avgFirstReview}d` : "—",
        trend: stats.avgFirstReview != null && stats.avgFirstReview <= 2 ? "up" as const : stats.avgFirstReview != null && stats.avgFirstReview > 4 ? "down" as const : "flat" as const,
        secondary: "Avg response time",
      },
      {
        label: "To Interview",
        value: `${stats.interviewConv}%`,
        trend: stats.interviewConv >= 30 ? "up" as const : stats.interviewConv >= 15 ? "flat" as const : "down" as const,
        secondary: "Screen → Interview",
      },
    ],
    [stats, pipelineHealthScore, appsTrend]
  );

  const stageBottlenecks = useMemo(() => {
    const stuckThresholdDays = 3;
    const now = new Date().getTime();
    const bottlenecks: Array<{ stage: string; message: string; actionLabel: string }> = [];
    pipelineStages.forEach((stage) => {
      const appsInStage = filteredApplications.filter((a) => a.currentStage === stage.id);
      const stuck = appsInStage.filter((a) => {
        if (!a.stageChangedAt) return false;
        const days = (now - new Date(a.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24);
        return days >= stuckThresholdDays;
      });
      if (stuck.length > 0) {
        bottlenecks.push({
          stage: stage.name,
          message: `${stuck.length} candidate(s) in this stage for > ${stuckThresholdDays} days`,
          actionLabel: "View candidates",
        });
      }
    });
    return bottlenecks;
  }, [pipelineStages, filteredApplications]);

  const dropoffSteps = useMemo(() => {
    if (dropoffData?.conversions?.length) {
      return dropoffData.conversions.map((c) => ({
        name: c.name,
        count: dropoffData.stages.find((s) => s.name === c.name)?.count ?? c.count,
        rate: c.rate,
      }));
    }
    return dropoffInsights.conversions.map((c) => ({
      name: c.name,
      count: c.count,
      rate: c.rate,
    }));
  }, [dropoffData, dropoffInsights]);

  const dropoffSummary = useMemo(() => {
    const weakest = dropoffInsights.weakest || dropoffData?.conversions?.find((c) => c.rate === Math.min(...(dropoffData?.conversions.map((x) => x.rate) || [0])));
    if (weakest) {
      return `Conversion into ${weakest.name} is ${weakest.rate}%. Consider nudging candidates or refining screening.`;
    }
    return "Pipeline is steady. No major drop-offs detected.";
  }, [dropoffInsights, dropoffData]);

  // Batched AI insights - one call per day, cached server-side
  const aiPayload = useMemo(() => {
    if (!pipelineHealthScore || !jobsNeedingAttention.length) return null;
    return {
      pipelineHealthScore,
      timeRangeLabel: `Last ${RANGE_PRESETS[rangePreset]} days`,
      applicationsOverTime: timeSeriesData.slice(-14),
      stageDistribution: funnelData.map((f) => ({ name: f.name, count: f.count })),
      dropoff: dropoffSteps,
      timeInStage: hiringMetrics?.timeInStage?.map((t) => ({ stageName: t.stageName, averageDays: t.averageDays })) || [],
      jobsNeedingAttention: jobsNeedingAttention.map((job) => ({
        jobId: job.jobId,
        title: job.jobTitle,
        severity: job.status === "red" ? "high" as const : job.status === "amber" ? "medium" as const : "low" as const,
        reason: job.reason || "Needs movement",
      })),
    };
  }, [pipelineHealthScore, rangePreset, timeSeriesData, funnelData, dropoffSteps, hiringMetrics, jobsNeedingAttention]);

  const { data: aiInsights, isLoading: aiLoading } = useQuery<DashboardAiInsights>({
    queryKey: ["/api/ai/dashboard-insights", aiPayload],
    queryFn: async () => {
      if (!aiPayload) throw new Error("No payload");
      const res = await fetch("/api/ai/dashboard-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(aiPayload),
      });
      if (!res.ok) throw new Error("AI insights failed");
      return res.json();
    },
    enabled: !!aiPayload,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours client-side
    retry: false,
  });

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
          {/* Header + filters + KPIs */}
          <div className="space-y-3 pt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Recruiter Dashboard</h1>
                <p className="text-slate-500 text-sm md:text-base">
                  Overview of jobs, applications, and hiring performance
                </p>
              </div>
            </div>
            <Card className="shadow-sm border-slate-200">
              <CardContent className="pt-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                  <div className="text-sm text-slate-600">
                    KPIs filtered by{" "}
                    <span className="font-semibold text-slate-800">
                      Last {RANGE_PRESETS[rangePreset]} days
                    </span>{" "}
                    ·{" "}
                    <span className="font-semibold text-slate-800">
                      {selectedJobId === "all" ? "All jobs" : `Job #${selectedJobId}`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={rangePreset} onValueChange={(val) => setRangePreset(val as keyof typeof RANGE_PRESETS)}>
                      <SelectTrigger className="w-40">
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
                      <SelectTrigger className="w-52">
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
                <RecruiterKpiRibbon
                  items={kpiItems}
                  heroLabel="Pipeline Health"
                  heroTooltip="Score based on stage movement, time in stage, drop-offs and stuck candidates."
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 bg-slate-50 border border-slate-100 rounded-md px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-900">Pipeline & time metrics</h2>
            <p className="text-sm text-slate-500">Charts and summaries respect the selected date range and job filters.</p>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <TimeSeriesChart
                title="Applications over time"
                description={`Applications over time — last ${RANGE_PRESETS[rangePreset]} days (filters applied)`}
                data={timeSeriesData}
                isLoading={applicationsLoading}
              />
              <p className="text-xs text-slate-500">Hover to see exact values by day.</p>
            </div>
            <div className="space-y-2">
              <FunnelChart
                title="Stage distribution"
                description={`Applications by pipeline stage — last ${RANGE_PRESETS[rangePreset]} days (filters applied)`}
                data={funnelData}
                isLoading={applicationsLoading || stagesLoading}
              />
              <p className="text-xs text-slate-500">
                {funnelData.length > 0 && funnelData[0]
                  ? `Most candidates are currently in ${funnelData[0].name}; consider reviewing and moving them forward.`
                  : "Review stage distribution to keep candidates moving."}
              </p>
            </div>
          </div>

          {/* AI Summary + Insights */}
          <AiPipelineSummary
            pipelineHealthScore={pipelineHealthScore}
            preGeneratedSummary={aiInsights?.summary}
            aiLoading={aiLoading}
            generatedAt={aiInsights?.generatedAt}
          />
          <RecruiterAiInsightsSection
            jobsNeedingAttention={jobsNeedingAttention.map((job) => ({
              jobId: job.jobId,
              title: job.jobTitle,
              severity: job.status === "red" ? "high" : job.status === "amber" ? "medium" : "low",
              reason: job.reason || "Needs movement",
            }))}
            jdSuggestions={jdSuggestions.map((j) => ({
              jobId: j.jobId,
              title: j.title,
              score: j.score,
              tips: j.tips,
            }))}
            dropoff={dropoffSteps}
            dropoffSummary={aiSummaryText || dropoffSummary}
            bottlenecks={stageBottlenecks}
            preGeneratedActions={aiInsights?.jobs}
            preGeneratedDropoffExplanation={aiInsights?.dropoffExplanation}
            aiLoading={aiLoading}
            onViewJob={(jobId) => setLocation(`/jobs/${jobId}`)}
            onEditJob={(jobId) => setLocation(`/jobs/${jobId}`)}
            onViewStage={(stage) => setLocation("/applications")}
          />

          {/* Hiring efficiency */}
          <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-md px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-900">Pipeline & time metrics</h2>
            <p className="text-sm text-slate-500">How long it takes to fill roles and move candidates through stages.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Time to fill by job
                </CardTitle>
                <CardDescription>Closed roles in this period.</CardDescription>
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
                          {row.averageDays ? `${row.averageDays.toFixed(1)}d` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{row.hiredCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!hiringMetrics?.timeToFill.byJob || hiringMetrics.timeToFill.byJob.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-6">
                          No closed roles in this period — once jobs are filled, they’ll show up here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-700" />
                  Time in stage breakdown
                </CardTitle>
                <CardDescription>Average days per stage for candidates currently in the pipeline.</CardDescription>
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
                        <TableCell className="text-sm text-slate-700">{row.averageDays.toFixed(1)}d</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.transitionCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!hiringMetrics?.timeInStage || hiringMetrics.timeInStage.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-6">
                          No stage transitions in this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Performance</h2>
            <p className="text-sm text-slate-500">Source effectiveness and candidate quality for this period.</p>
          </div>
          {/* Source + quality */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-700" />
                  Source performance
                </CardTitle>
                <CardDescription>Applications, shortlist, hires by source.</CardDescription>
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
                    {sourcePerformance.map((row) => {
                      const maxApps = Math.max(...sourcePerformance.map((r) => r.apps || 0), 1);
                      const width = Math.max(8, Math.min(100, Math.round((row.apps / maxApps) * 100)));
                      return (
                        <TableRow key={row.source}>
                          <TableCell className="text-sm text-slate-800">{row.source}</TableCell>
                          <TableCell className="text-sm text-slate-700">
                            <div className="flex items-center gap-2">
                              <div className="h-2 bg-blue-100 rounded-full w-full max-w-[120px]">
                                <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${width}%` }} />
                              </div>
                              <span>{row.apps}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{row.shortlist}</TableCell>
                          <TableCell className="text-sm text-slate-700">{row.hires}</TableCell>
                          <TableCell className="text-sm text-slate-700">{row.conversion}%</TableCell>
                        </TableRow>
                      );
                    })}
                    {sourcePerformance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">
                          Referrals and direct sourcing performance will appear here when used for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <p className="text-xs text-slate-500 px-4 py-3">
                  Conversion compares hires to total applications; shortlist bars show relative volume by source.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" />
                  Candidate quality
                </CardTitle>
                <CardDescription>Based on AI fit labels.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(candidateFit.length === 0 || candidateFit.every((c) => c.label === "Unscored")) && (
                  <p className="text-sm text-slate-500">AI candidate scoring not yet available for this period.</p>
                )}
                {candidateFit.length > 0 && !candidateFit.every((c) => c.label === "Unscored") && (
                  <div className="space-y-2">
                    {candidateFit
                      .filter((row) => row.label !== "Unscored")
                      .map((row) => (
                        <div key={row.label} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">{row.label}</span>
                          <span className="font-semibold text-slate-900">
                            {row.count} ({row.percent}%)
                          </span>
                        </div>
                      ))}
                    <p className="text-xs text-slate-500">
                      {candidateFit
                        .filter((c) => c.label !== "Unscored")
                        .map((c) => `${c.label} ${c.percent}%`)
                        .join(" · ")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance: Recruiters vs Hiring Managers */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-900">Team performance</h2>
            <p className="text-sm text-slate-500">Responsiveness and throughput for recruiters and hiring managers.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-700" />
                  Recruiter Performance
                </CardTitle>
                <CardDescription>Jobs handled, candidates screened, and action speeds.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Jobs handled</TableHead>
                      <TableHead>Candidates screened</TableHead>
                      <TableHead>Avg time to first action</TableHead>
                      <TableHead>Avg days to move stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(performance?.recruiters || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-slate-800">
                          {row.name}
                          {/* TODO: highlight current user row when auth context is available */}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{row.jobsHandled}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.candidatesScreened}</TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {row.avgFirstActionDays != null ? `${row.avgFirstActionDays}d` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {row.avgStageMoveDays != null ? `${row.avgStageMoveDays}d` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!performance?.recruiters || performance.recruiters.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-4">
                          No recruiter metrics for this range.
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
                  <Briefcase className="h-4 w-4 text-slate-700" />
                  Hiring Manager Performance
                </CardTitle>
                <CardDescription>Jobs owned, feedback latency, waiting count.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hiring Manager</TableHead>
                      <TableHead>Jobs owned</TableHead>
                      <TableHead>Avg feedback</TableHead>
                      <TableHead>Waiting</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(performance?.hiringManagers || []).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-slate-800">{row.name}</TableCell>
                        <TableCell className="text-sm text-slate-700">{row.jobsOwned}</TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {row.avgFeedbackDays != null ? `${row.avgFeedbackDays}d` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{row.waitingCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!performance?.hiringManagers || performance.hiringManagers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-slate-500 py-6">
                          No hiring manager feedback data in this period. Once HMs are assigned and start reviewing candidates, their responsiveness will appear here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
