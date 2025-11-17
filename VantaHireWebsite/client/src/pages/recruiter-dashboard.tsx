import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, Download, FileText, Users, Briefcase, Clock, CheckCircle, XCircle, ExternalLink, Plus, Mail, Calendar, BarChart, Play, Sparkles, Brain, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import type { Job, Application, PipelineStage } from "@shared/schema";
import { KpiCard } from "@/components/dashboards/KpiCard";
import { TimeSeriesChart } from "@/components/dashboards/TimeSeriesChart";
import { FunnelChart } from "@/components/dashboards/FunnelChart";
import { RecentApplicationsList } from "@/components/dashboards/RecentApplicationsList";

// Extended types for API responses with relations
type ApplicationWithJob = Application & {
  job?: { title: string };
};

type JobWithCounts = Job & {
  company?: string;
  applicationCount?: number;
};

export default function RecruiterDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");

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

  // Update application status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status, notes }: { applicationId: number; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/status`, {
        status,
        reviewNotes: notes
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-applications-received"] });
      toast({
        title: "Application Updated",
        description: "Application status has been updated successfully.",
      });
      setSelectedApplicationId(null);
      setReviewNotes("");
      setNewStatus("");
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Download resume mutation
  const downloadResumeMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      await apiRequest("PATCH", `/api/applications/${applicationId}/download`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-applications-received"] });
    },
  });

  // Publish job mutation
  const publishJobMutation = useMutation({
    mutationFn: async ({ jobId, isActive }: { jobId: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/status`, { isActive });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-jobs"] });
      toast({
        title: "Job Published",
        description: "Your job is now live and accepting applications!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Publish Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = () => {
    if (selectedApplicationId && newStatus) {
      updateStatusMutation.mutate({
        applicationId: selectedApplicationId,
        status: newStatus,
        notes: reviewNotes
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'reviewed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'shortlisted': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getJobStats = () => {
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter((job) => job.isActive).length;
    const totalApplications = applications.length;
    const pendingApplications = applications.filter((app) => app.status === 'submitted').length;

    return { totalJobs, activeJobs, totalApplications, pendingApplications };
  };

  const getFitBadge = (score: number | null | undefined, label: string | null | undefined) => {
    if (score === null || score === undefined || label === null || label === undefined) return null;

    const colorMap: Record<string, string> = {
      'Exceptional': 'bg-green-50 text-green-700 border-green-200',
      'Strong': 'bg-blue-50 text-blue-700 border-blue-200',
      'Good': 'bg-purple-50 text-purple-700 border-purple-200',
      'Partial': 'bg-amber-50 text-amber-700 border-amber-200',
      'Low': 'bg-red-50 text-red-700 border-red-200',
    };

    const colorClass = colorMap[label] || 'bg-slate-100 text-slate-600 border-slate-200';

    return (
      <Badge variant="outline" className={`${colorClass} font-medium`}>
        <Sparkles className="w-3 h-3 mr-1" />
        {label} ({score})
      </Badge>
    );
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
          {/* Header with Quick Actions */}
          <div className="space-y-4 pt-8">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Recruiter Dashboard</h1>
              <p className="text-slate-500 text-sm md:text-base">Manage your job postings and applications</p>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap gap-3 mt-4">
              <Button
                onClick={() => setLocation("/jobs/post")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Post New Job
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/analytics")}
              >
                <BarChart className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (jobs.length > 0 && jobs[0]) {
                    setLocation(`/jobs/${jobs[0].id}/applications`);
                  } else {
                    toast({
                      title: "No jobs available",
                      description: "Please post a job first before sending bulk emails.",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Bulk Email
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (jobs.length > 0 && jobs[0]) {
                    setLocation(`/jobs/${jobs[0].id}/applications`);
                  } else {
                    toast({
                      title: "No jobs available",
                      description: "Please post a job first before scheduling interviews.",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Interviews
              </Button>
            </div>
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

          {/* Recent Applications */}
          <RecentApplicationsList
            title="Recent Applications"
            description="Latest applications received"
            applications={recentApplications}
            limit={10}
            isLoading={applicationsLoading}
            onApplicationClick={(id) => setSelectedApplicationId(id)}
          />

          {/* Main Content */}
          <Tabs defaultValue="applications" className="space-y-6">
            <TabsList>
              <TabsTrigger value="applications">
                Applications
              </TabsTrigger>
              <TabsTrigger value="jobs">
                My Job Postings
              </TabsTrigger>
            </TabsList>

            {/* Applications Tab */}
            <TabsContent value="applications">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg">Application Management</CardTitle>
                  <CardDescription>
                    Review and manage candidate applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {applications.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No applications received yet</p>
                      </div>
                    ) : (
                      applications.map((application) => (
                        <div
                          key={application.id}
                          className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3"
                          data-testid="application-row"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="text-slate-900 font-medium">{application.name}</h3>
                              <p className="text-slate-600 text-sm">{application.email}</p>
                              <p className="text-slate-500 text-sm">Applied for: {application.job?.title}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(application.status)}>
                                {application.status}
                              </Badge>
                              {getFitBadge(application.aiFitScore, application.aiFitLabel)}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedApplicationId(application.id)}
                                data-testid="review-application"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              {application.resumeUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    downloadResumeMutation.mutate(application.id);
                                    window.open(`/api/applications/${application.id}/resume`, '_blank');
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Resume
                                </Button>
                              )}
                            </div>
                          </div>

                          {application.coverLetter && (
                            <div className="pt-2 border-t border-slate-200">
                              <p className="text-slate-600 text-sm">
                                <strong>Cover Letter:</strong> {application.coverLetter}
                              </p>
                            </div>
                          )}

                          {/* AI Fit Analysis */}
                          {application.aiFitScore !== null && application.aiFitScore !== undefined && application.aiFitReasons && Array.isArray(application.aiFitReasons) ? (
                            <div className="pt-2 border-t border-slate-200">
                              <div className="p-3 bg-primary/5 rounded-lg border-l-4 border-primary">
                                <div className="flex items-center gap-2 mb-2">
                                  <Brain className="w-4 h-4 text-primary" />
                                  <span className="text-primary font-medium text-sm">AI Fit Analysis</span>
                                </div>
                                <ul className="text-slate-600 text-sm space-y-1">
                                  {(application.aiFitReasons as string[]).slice(0, 3).map((reason: string, idx: number): JSX.Element => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                                {application.aiStaleReason && (
                                  <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Score may be outdated ({application.aiStaleReason})
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {selectedApplicationId === application.id && (
                            <div className="pt-4 border-t border-slate-200 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-slate-900 text-sm font-medium mb-2 block">
                                    Update Status
                                  </label>
                                  <Select value={newStatus} onValueChange={setNewStatus} data-testid="status-select">
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select new status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="reviewed">Reviewed</SelectItem>
                                      <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-slate-900 text-sm font-medium mb-2 block">
                                    Review Notes
                                  </label>
                                  <Textarea
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Add your review notes..."
                                    data-testid="review-notes"
                                  />
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  onClick={handleStatusUpdate}
                                  disabled={!newStatus || updateStatusMutation.isPending}
                                >
                                  Save Review
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedApplicationId(null);
                                    setReviewNotes("");
                                    setNewStatus("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Jobs Tab */}
            <TabsContent value="jobs">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-lg">My Job Postings</CardTitle>
                  <CardDescription>
                    Manage your posted job opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {jobs.length === 0 ? (
                      <div className="text-center py-8">
                        <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No job postings yet</p>
                        <Button className="mt-4">
                          Post Your First Job
                        </Button>
                      </div>
                    ) : (
                      jobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-4 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="text-slate-900 font-medium text-lg">{job.title}</h3>
                              <p className="text-slate-600">{job.company} • {job.location}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(job.status)}>
                                {job.status}
                              </Badge>
                              <span className="text-slate-500 text-sm">
                                {job.applicationCount || 0} applications
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-500 text-sm mb-3">{job.description}</p>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/jobs/${job.id}/applications`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Applications
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              Edit Job
                            </Button>
                            {job.status === 'approved' && !job.isActive && (
                              <Button
                                size="sm"
                                onClick={() => publishJobMutation.mutate({ jobId: job.id, isActive: true })}
                                disabled={publishJobMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {publishJobMutation.isPending ? 'Publishing...' : 'Publish Job'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
