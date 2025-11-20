import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Briefcase, Clock, CheckCircle, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import type { Job, Application, PipelineStage } from "@shared/schema";
import { KpiCard } from "@/components/dashboards/KpiCard";
import { TimeSeriesChart } from "@/components/dashboards/TimeSeriesChart";
import { FunnelChart } from "@/components/dashboards/FunnelChart";
import { RecentApplicationsList } from "@/components/dashboards/RecentApplicationsList";
import { HiringMetricsPanel } from "@/components/HiringMetricsPanel";

// Extended types for API responses with relations
type ApplicationWithJob = Application & {
  job?: { title: string };
};

type JobWithCounts = Job & {
  company?: string;
  applicationCount?: number;
};

export default function RecruiterDashboard() {
  const [, setLocation] = useLocation();

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

  const getJobStats = () => {
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((job) => job.isActive).length;
    const totalApplications = applications.length;
    const pendingApplications = applications.filter((app) => app.status === 'submitted').length;

    return { totalJobs, activeJobs, totalApplications, pendingApplications };
  };

  const stats = getJobStats();

  // Aggregate time-series data (applications over last 30 days)
  const timeSeriesData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Create buckets for each day
    const buckets: Record<string, number> = {};
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().slice(0, 10);
      buckets[dateKey] = 0;
    }

    // Count applications per day
    applications.forEach((app) => {
      const appDate = new Date(app.appliedAt);
      if (appDate >= thirtyDaysAgo) {
        const dateKey = appDate.toISOString().slice(0, 10);
        if (buckets[dateKey] !== undefined) {
          buckets[dateKey]++;
        }
      }
    });

    return Object.entries(buckets)
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [applications]);

  // Aggregate funnel data (stage distribution)
  const funnelData = useMemo(() => {
    const stageCounts: Record<number, number> = {};

    applications.forEach((app) => {
      const stageId = app.currentStage || 0;
      stageCounts[stageId] = (stageCounts[stageId] || 0) + 1;
    });

    return Object.entries(stageCounts)
      .map(([stageId, count]) => {
        const stage = pipelineStages.find(s => s.id === parseInt(stageId));
        return {
          name: stage?.name || 'Unassigned',
          count,
          color: stage?.color || '#64748b',
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [applications, pipelineStages]);

  // Prepare recent applications list
  const recentApplications = useMemo(() => {
    return applications
      .map(app => {
        const item: {
          id: number;
          name: string;
          email: string;
          jobTitle?: string;
          appliedAt: Date;
          status: string;
        } = {
          id: app.id,
          name: app.name,
          email: app.email,
          appliedAt: app.appliedAt,
          status: app.status,
        };
        if (app.job?.title) {
          item.jobTitle = app.job.title;
        }
        return item;
      })
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }, [applications]);

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
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Recruiter Dashboard</h1>
            <p className="text-slate-500 text-sm md:text-base">Overview of your recruitment activity</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KpiCard
              label="Total Jobs"
              value={stats.totalJobs}
              icon={Briefcase}
              isLoading={jobsLoading}
            />
            <KpiCard
              label="Active Jobs"
              value={stats.activeJobs}
              icon={CheckCircle}
              isLoading={jobsLoading}
            />
            <KpiCard
              label="Total Applications"
              value={stats.totalApplications}
              icon={Users}
              isLoading={applicationsLoading}
            />
            <KpiCard
              label="Pending Reviews"
              value={stats.pendingApplications}
              icon={Clock}
              isLoading={applicationsLoading}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeSeriesChart
              title="Applications Over Time"
              description="Last 30 days"
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

          {/* Recent Applications Preview */}
          <RecentApplicationsList
            title="Recent Applications"
            description="Latest 5 applications received"
            applications={recentApplications}
            limit={5}
            isLoading={applicationsLoading}
            onApplicationClick={(id) => setLocation("/applications")}
          />

          {/* Hiring Metrics */}
          <HiringMetricsPanel />

          {/* Quick Links */}
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
              <ArrowRight className="h-5 w-5 text-slate-400" />
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
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
