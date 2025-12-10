import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { 
  Users, 
  Briefcase, 
  FileText, 
  Settings, 
  Eye,
  Trash2,
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  Download,
  Shield,
  Activity,
  Crown,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";
import type { PipelineStage } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Types for analytics data
type HiringMetrics = {
  timeToFill: {
    overall: number | null;
    byJob: Array<{
      jobId: number;
      jobTitle: string;
      averageDays: number;
      hiredCount: number;
    }>;
  };
  timeInStage: Array<{
    stageId: number;
    stageName: string;
    stageOrder: number;
    averageDays: number;
    transitionCount: number;
  }>;
  totalApplications: number;
  totalHires: number;
  conversionRate: number;
};

type SourcePerfRow = {
  source: string;
  apps: number;
  shortlist: number;
  hires: number;
  conversion: number;
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

interface AdminStats {
  totalJobs: number;
  activeJobs: number;
  pendingJobs: number;
  totalApplications: number;
  totalUsers: number;
  totalRecruiters: number;
}

interface JobWithDetails {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string | null;
  applicationCount: number;
  reviewComments?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    username: string;
  } | null;
  postedBy: {
    id: number;
    firstName: string;
    lastName: string;
    username: string;
  };
}

interface ApplicationWithDetails {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  coverLetter: string;
  status: string;
  currentStage?: number | null;
  stageName?: string | null;
  stageOrder?: number | null;
  appliedAt: string;
  viewedAt?: string;
  downloadedAt?: string;
  notes?: string;
  job: {
    id: number;
    title: string;
    company: string;
  };
  recruiterNotes?: string;
}

interface UserDetails {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  profile?: {
    bio?: string;
    skills?: string[];
    linkedin?: string;
    location?: string;
  };
  jobCount?: number;
  applicationCount?: number;
}

export default function AdminSuperDashboard() {
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
  const [jobFilter, setJobFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [applicationStageFilter, setApplicationStageFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch admin statistics
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  // Fetch all jobs with details
  const { data: jobs, isLoading: jobsLoading } = useQuery<JobWithDetails[]>({
    queryKey: ["/api/admin/jobs/all"],
  });

  // Fetch all applications with details
  const { data: applications, isLoading: applicationsLoading } = useQuery<ApplicationWithDetails[]>({
    queryKey: ["/api/admin/applications/all"],
  });

  // Fetch pipeline stages for filtering and labels
  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
  });

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery<UserDetails[]>({
    queryKey: ["/api/admin/users"],
  });

  // Analytics queries - org-wide metrics
  const { data: hiringMetrics, isLoading: metricsLoading } = useQuery<HiringMetrics>({
    queryKey: ["/api/analytics/hiring-metrics"],
    queryFn: async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000); // Last 90 days
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const res = await fetch(`/api/analytics/hiring-metrics?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hiring metrics");
      return res.json();
    },
  });

  const { data: sourcePerformance, isLoading: sourcePerfLoading } = useQuery<SourcePerfRow[]>({
    queryKey: ["/api/analytics/source-performance"],
    queryFn: async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const res = await fetch(`/api/analytics/source-performance?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch source performance");
      return res.json();
    },
  });

  const { data: teamPerformance, isLoading: teamPerfLoading } = useQuery<PerformanceResponse>({
    queryKey: ["/api/analytics/performance"],
    queryFn: async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      const res = await fetch(`/api/analytics/performance?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team performance");
      return res.json();
    },
  });

  // Update job status mutation
  const updateJobMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${id}/status`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Job status updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update job status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Job deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update application status mutation
  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/applications/${id}/status`, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Application status updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update application status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Review job mutation (approve/decline)
  const reviewJobMutation = useMutation({
    mutationFn: async ({ id, status, comments }: { id: number; status: string; comments?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/jobs/${id}/review`, { status, reviewComments: comments });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Job review status updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update job review status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "User role updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter functions
  const filteredJobs = jobs?.filter(job => {
    const matchesFilter = jobFilter === "all" || 
      (jobFilter === "active" && job.isActive) ||
      (jobFilter === "inactive" && !job.isActive) ||
      (jobFilter === "pending" && job.status === "pending") ||
      (jobFilter === "approved" && job.status === "approved");
    
    const matchesSearch = !searchTerm || 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const filteredApplications = applications?.filter(app => {
    const matchesFilter = applicationFilter === "all" || app.status === applicationFilter;
    const matchesStage = applicationStageFilter === "all" ||
      (applicationStageFilter === "unassigned" && app.currentStage == null) ||
      (applicationStageFilter !== "unassigned" && app.currentStage === parseInt(applicationStageFilter));
    const matchesSearch = !searchTerm || 
      app.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.job.company.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesStage && matchesSearch;
  });

  const filteredUsers = users?.filter(user => {
    const matchesFilter = userFilter === "all" || user.role === userFilter;
    const matchesSearch = !searchTerm || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    const configs = {
      submitted: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Submitted" },
      reviewed: { color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Eye, label: "Under Review" },
      shortlisted: { color: "bg-green-50 text-green-700 border-green-200", icon: UserCheck, label: "Shortlisted" },
      rejected: { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle, label: "Rejected" },
      downloaded: { color: "bg-purple-50 text-purple-700 border-purple-200", icon: Download, label: "Downloaded" },
      pending: { color: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertCircle, label: "Pending Review" },
      approved: { color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Approved" },
    };
    return configs[status as keyof typeof configs] || configs.submitted;
  };

  const getRoleColor = (role: string) => {
    const colors = {
      admin: "bg-red-50 text-red-700 border-red-200",
      recruiter: "bg-purple-50 text-purple-700 border-purple-200",
      candidate: "bg-blue-50 text-blue-700 border-blue-200",
    };
    return colors[role as keyof typeof colors] || colors.candidate;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-4 pt-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Super Dashboard</h1>
              <p className="text-slate-500">Complete platform control and management</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-4 mt-6">
            <Button
              onClick={() => window.location.href = '/admin/testing'}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Testing Dashboard
            </Button>
            <Button
              onClick={() => window.location.href = '/analytics'}
              variant="outline"
            >
              <Activity className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Jobs</CardTitle>
              <Briefcase className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalJobs || 0}</div>
              <p className="text-xs text-slate-500">
                {stats?.activeJobs || 0} active, {stats?.pendingJobs || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Applications</CardTitle>
              <FileText className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalApplications || 0}</div>
              <p className="text-xs text-slate-500">Across all jobs</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-slate-500">
                {stats?.totalRecruiters || 0} recruiters
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Platform Activity</CardTitle>
              <Activity className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">Live</div>
              <p className="text-xs text-slate-500">System operational</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="pending" className="relative">
              <AlertCircle className="h-4 w-4 mr-2" />
              Pending Approval
              {stats?.pendingJobs && stats.pendingJobs > 0 && (
                <Badge className="ml-2 bg-orange-500 text-white text-xs px-1.5 py-0.5">
                  {stats.pendingJobs}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Briefcase className="h-4 w-4 mr-2" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="applications">
              <FileText className="h-4 w-4 mr-2" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Settings className="h-4 w-4 mr-2" />
              System Logs
            </TabsTrigger>
          </TabsList>

          {/* Pending Approval Tab */}
          <TabsContent value="pending" className="space-y-6">
            <Card className="shadow-sm border-orange-200">
              <CardHeader className="bg-orange-50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      Jobs Pending Approval
                    </CardTitle>
                    <CardDescription className="text-slate-900/70">
                      Review and approve or decline job postings before they go live
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                    {jobs?.filter(j => j.status === 'pending').length || 0} pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {jobsLoading ? (
                  <div className="text-center py-8 text-slate-900/70">Loading jobs...</div>
                ) : (
                  <div className="space-y-4">
                    {jobs?.filter(j => j.status === 'pending').length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                        <p className="text-lg font-medium">All caught up!</p>
                        <p className="text-sm">No jobs pending approval</p>
                      </div>
                    ) : (
                      jobs?.filter(j => j.status === 'pending').map((job) => (
                        <div key={job.id} data-testid="job-row" data-job-id={job.id} className="border border-orange-200 rounded-lg p-4 bg-white hover:bg-orange-50/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center space-x-3">
                                <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                                <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                  Pending Review
                                </Badge>
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-slate-900/70">
                                <span className="flex items-center space-x-1">
                                  <MapPin className="h-4 w-4" />
                                  <span>{job.company} • {job.location}</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{format(new Date(job.createdAt), "MMM d, yyyy")}</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <Clock className="h-4 w-4" />
                                  <span>{job.type}</span>
                                </span>
                              </div>
                              <p className="text-slate-900/60 text-sm">
                                Posted by: {job.postedBy.firstName} {job.postedBy.lastName} ({job.postedBy.username})
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedJob(job)}
                                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => reviewJobMutation.mutate({ id: job.id, status: 'approved' })}
                                disabled={reviewJobMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white"
                                data-testid="approve-job"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => reviewJobMutation.mutate({ id: job.id, status: 'declined' })}
                                disabled={reviewJobMutation.isPending}
                                className="border-red-300 text-red-700 hover:bg-red-50"
                                data-testid="decline-job"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Jobs Management Tab */}
          <TabsContent value="jobs" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                  <div>
                    <CardTitle className="text-slate-900">Jobs Management</CardTitle>
                    <CardDescription className="text-slate-900/70">
                      View, edit, and manage all platform jobs
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4 text-slate-900/50" />
                      <Input
                        placeholder="Search jobs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <Select value={jobFilter} onValueChange={setJobFilter}>
                      <SelectTrigger className="bg-white border-slate-300">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200">
                        <SelectItem value="all">All Jobs</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="text-center py-8 text-slate-900/70">Loading jobs...</div>
                ) : (
                  <div className="space-y-4">
                    {filteredJobs?.map((job) => (
                      <div key={job.id} data-testid="job-row" data-job-id={job.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold text-slate-900">{job.title}</h3>
                              <Badge className={getStatusConfig(job.status).color}>
                                {getStatusConfig(job.status).label}
                              </Badge>
                              <Badge className={job.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                                {job.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-slate-900/70">
                              <span className="flex items-center space-x-1">
                                <MapPin className="h-4 w-4" />
                                <span>{job.company} • {job.location}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(job.createdAt), "MMM d, yyyy")}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <FileText className="h-4 w-4" />
                                <span>{job.applicationCount} applications</span>
                              </span>
                            </div>
                            <p className="text-slate-900/60 text-sm">
                              Posted by: {job.postedBy.firstName} {job.postedBy.lastName} ({job.postedBy.username})
                            </p>
                            {/* Show review info for reviewed jobs */}
                            {(job.status === 'approved' || job.status === 'declined') && job.reviewedAt && (
                              <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-200" data-testid="reviewed-by">
                                <p className="text-xs text-slate-600">
                                  <span className="font-medium">{job.status === 'approved' ? 'Approved' : 'Declined'}</span>
                                  {job.reviewedBy && (
                                    <span> by {job.reviewedBy.firstName} {job.reviewedBy.lastName}</span>
                                  )}
                                  <span> on {format(new Date(job.reviewedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                                </p>
                                {job.reviewComments && (
                                  <p className="text-xs text-slate-500 mt-1 italic">"{job.reviewComments}"</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {job.status === 'pending' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => reviewJobMutation.mutate({ id: job.id, status: 'approved' })}
                                  className="border-green-600 text-green-700 hover:bg-green-50 bg-white"
                                  data-testid="approve-job"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => reviewJobMutation.mutate({ id: job.id, status: 'declined' })}
                                  className="border-red-600 text-red-700 hover:bg-red-50 bg-white"
                                  data-testid="decline-job"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Decline
                                </Button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedJob(job)}
                              className="border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateJobMutation.mutate({ id: job.id, isActive: !job.isActive })}
                              className="border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                              {job.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-red-600 text-red-700 hover:bg-red-50 bg-white"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white border-slate-200">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-slate-900">Delete Job</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-900/70">
                                    Are you sure you want to delete "{job.title}"? This action cannot be undone and will remove all associated applications.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-white border-slate-300">Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteJobMutation.mutate(job.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Applications Management Tab */}
          <TabsContent value="applications" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                  <div>
                    <CardTitle className="text-slate-900">Applications Management</CardTitle>
                    <CardDescription className="text-slate-900/70">
                      Review and manage all job applications
                    </CardDescription>
                  </div>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                      <div className="flex items-center space-x-2">
                        <Search className="h-4 w-4 text-slate-900/50" />
                        <Input
                          placeholder="Search applications..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white border-slate-300"
                      />
                    </div>
                      <Select value={applicationFilter} onValueChange={setApplicationFilter}>
                        <SelectTrigger className="bg-white border-slate-300">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          <SelectItem value="all">All Applications</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="reviewed">Under Review</SelectItem>
                          <SelectItem value="shortlisted">Shortlisted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={applicationStageFilter} onValueChange={setApplicationStageFilter}>
                        <SelectTrigger className="bg-white border-slate-300">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Stage" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200">
                          <SelectItem value="all">All Stages</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {pipelineStages
                            .slice()
                            .sort((a, b) => a.order - b.order)
                            .map((stage) => (
                              <SelectItem key={stage.id} value={stage.id.toString()}>
                                {stage.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="text-center py-8 text-slate-900/70">Loading applications...</div>
                ) : (
                  <div className="space-y-4">
                    {filteredApplications?.map((application) => (
                      <div key={application.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-slate-900">{application.fullName}</h3>
                            <Badge className={getStatusConfig(application.status).color}>
                              {getStatusConfig(application.status).label}
                            </Badge>
                            {application.stageName && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {application.stageName}
                              </Badge>
                            )}
                          </div>
                            <div className="flex items-center space-x-4 text-sm text-slate-900/70">
                              <span>{application.email}</span>
                              <span>{application.phone}</span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(application.appliedAt), "MMM d, yyyy")}</span>
                              </span>
                            </div>
                            <p className="text-slate-900/60 text-sm">
                              Applied for: {application.job.title} at {application.job.company}
                            </p>
                            {application.notes && (
                              <p className="text-slate-900/60 text-sm bg-slate-100 p-2 rounded">
                                Notes: {application.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedApplication(application)}
                              className="border-slate-200 text-slate-900 hover:bg-slate-100"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Select
                              value={application.status}
                              onValueChange={(status) => updateApplicationMutation.mutate({ id: application.id, status })}
                            >
                              <SelectTrigger className="w-32 bg-white border-slate-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200">
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="reviewed">Under Review</SelectItem>
                                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                  <div>
                    <CardTitle className="text-slate-900">Users Management</CardTitle>
                    <CardDescription className="text-slate-900/70">
                      Manage user roles and permissions
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4 text-slate-900/50" />
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger className="bg-white border-slate-300">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200">
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                        <SelectItem value="recruiter">Recruiters</SelectItem>
                        <SelectItem value="candidate">Candidates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-slate-900/70">Loading users...</div>
                ) : (
                  <div className="space-y-4">
                    {filteredUsers?.map((user) => (
                      <div key={user.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {user.firstName} {user.lastName}
                              </h3>
                              <Badge className={getRoleColor(user.role)}>
                                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-slate-900/70">
                              <span>{user.username}</span>
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-4 w-4" />
                                <span>Joined {format(new Date(user.createdAt), "MMM d, yyyy")}</span>
                              </span>
                              {user.jobCount !== undefined && (
                                <span>{user.jobCount} jobs posted</span>
                              )}
                              {user.applicationCount !== undefined && (
                                <span>{user.applicationCount} applications</span>
                              )}
                            </div>
                            {user.profile && (
                              <div className="text-slate-900/60 text-sm space-y-1">
                                {user.profile.location && (
                                  <p className="flex items-center space-x-1">
                                    <MapPin className="h-3 w-3" />
                                    <span>{user.profile.location}</span>
                                  </p>
                                )}
                                {user.profile.skills && user.profile.skills.length > 0 && (
                                  <p>Skills: {user.profile.skills.slice(0, 3).join(", ")}</p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Select
                              value={user.role}
                              onValueChange={(role) => updateUserRoleMutation.mutate({ id: user.id, role })}
                            >
                              <SelectTrigger className="w-32 bg-white border-slate-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-slate-200">
                                <SelectItem value="candidate">Candidate</SelectItem>
                                <SelectItem value="recruiter">Recruiter</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="space-y-6">
              {/* Time to Fill & Time in Stage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      Time to Fill by Job
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Average days from posting to hire (last 90 days)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="text-center py-4 text-slate-500">Loading...</div>
                    ) : hiringMetrics?.timeToFill.byJob?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job Title</TableHead>
                            <TableHead className="text-right">Avg Days</TableHead>
                            <TableHead className="text-right">Hires</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hiringMetrics.timeToFill.byJob.slice(0, 10).map((row) => (
                            <TableRow key={row.jobId}>
                              <TableCell className="font-medium">{row.jobTitle}</TableCell>
                              <TableCell className="text-right">{row.averageDays.toFixed(1)}d</TableCell>
                              <TableCell className="text-right">{row.hiredCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-slate-500">No hiring data yet</div>
                    )}
                    {hiringMetrics?.timeToFill.overall && (
                      <div className="mt-4 pt-4 border-t text-sm">
                        <span className="text-slate-600">Overall average: </span>
                        <span className="font-semibold text-slate-900">{hiringMetrics.timeToFill.overall.toFixed(1)} days</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-600" />
                      Time in Stage Breakdown
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Average days candidates spend in each stage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="text-center py-4 text-slate-500">Loading...</div>
                    ) : hiringMetrics?.timeInStage?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Stage</TableHead>
                            <TableHead className="text-right">Avg Days</TableHead>
                            <TableHead className="text-right">Transitions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hiringMetrics.timeInStage
                            .sort((a, b) => a.stageOrder - b.stageOrder)
                            .map((row) => (
                              <TableRow key={row.stageId}>
                                <TableCell className="font-medium">{row.stageName}</TableCell>
                                <TableCell className="text-right">{row.averageDays.toFixed(1)}d</TableCell>
                                <TableCell className="text-right">{row.transitionCount}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-slate-500">No stage transition data yet</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Source Performance */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Source Performance
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Application sources and their conversion rates (last 90 days)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sourcePerfLoading ? (
                    <div className="text-center py-4 text-slate-500">Loading...</div>
                  ) : sourcePerformance?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Applications</TableHead>
                          <TableHead className="text-right">Shortlisted</TableHead>
                          <TableHead className="text-right">Hired</TableHead>
                          <TableHead className="text-right">Conversion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourcePerformance.map((row) => (
                          <TableRow key={row.source}>
                            <TableCell className="font-medium capitalize">{row.source || 'Direct'}</TableCell>
                            <TableCell className="text-right">{row.apps}</TableCell>
                            <TableCell className="text-right">{row.shortlist}</TableCell>
                            <TableCell className="text-right">{row.hires}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={row.conversion >= 10 ? "default" : "secondary"} className={row.conversion >= 10 ? "bg-green-100 text-green-800" : ""}>
                                {row.conversion}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-4 text-slate-500">No source data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Team Performance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Recruiter Performance
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Recruiter activity and response times
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {teamPerfLoading ? (
                      <div className="text-center py-4 text-slate-500">Loading...</div>
                    ) : teamPerformance?.recruiters?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Recruiter</TableHead>
                            <TableHead className="text-right">Jobs</TableHead>
                            <TableHead className="text-right">Screened</TableHead>
                            <TableHead className="text-right">Avg First Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamPerformance.recruiters.slice(0, 10).map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-right">{row.jobsHandled}</TableCell>
                              <TableCell className="text-right">{row.candidatesScreened}</TableCell>
                              <TableCell className="text-right">
                                {row.avgFirstActionDays != null ? `${row.avgFirstActionDays.toFixed(1)}d` : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-slate-500">No recruiter data yet</div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-600" />
                      Hiring Manager Performance
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Feedback turnaround and pending reviews
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {teamPerfLoading ? (
                      <div className="text-center py-4 text-slate-500">Loading...</div>
                    ) : teamPerformance?.hiringManagers?.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Hiring Manager</TableHead>
                            <TableHead className="text-right">Jobs Owned</TableHead>
                            <TableHead className="text-right">Avg Feedback</TableHead>
                            <TableHead className="text-right">Waiting</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamPerformance.hiringManagers.slice(0, 10).map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-right">{row.jobsOwned}</TableCell>
                              <TableCell className="text-right">
                                {row.avgFeedbackDays != null ? `${row.avgFeedbackDays.toFixed(1)}d` : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                {row.waitingCount > 0 ? (
                                  <Badge className="bg-orange-100 text-orange-800">{row.waitingCount}</Badge>
                                ) : (
                                  '0'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-4 text-slate-500">No hiring manager data yet</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary Stats */}
              <Card className="shadow-sm bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardContent className="py-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    <div>
                      <div className="text-3xl font-bold text-blue-700">
                        {hiringMetrics?.totalApplications ?? 0}
                      </div>
                      <div className="text-sm text-slate-600">Total Applications</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-green-700">
                        {hiringMetrics?.totalHires ?? 0}
                      </div>
                      <div className="text-sm text-slate-600">Total Hires</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-purple-700">
                        {hiringMetrics?.conversionRate?.toFixed(1) ?? 0}%
                      </div>
                      <div className="text-sm text-slate-600">Conversion Rate</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-amber-700">
                        {hiringMetrics?.timeToFill.overall?.toFixed(0) ?? '—'}
                      </div>
                      <div className="text-sm text-slate-600">Avg Time to Fill (days)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">System Activity Logs</CardTitle>
                <CardDescription className="text-slate-900/70">
                  Monitor platform activity and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-slate-900/70">{format(new Date(), "MMM d, yyyy HH:mm")}</span>
                      <span className="text-slate-900">System</span>
                      <span className="text-green-600">Platform operational - All systems running</span>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-slate-900/70">{format(new Date(Date.now() - 300000), "MMM d, yyyy HH:mm")}</span>
                      <span className="text-slate-900">Database</span>
                      <span className="text-blue-600">User profiles table created successfully</span>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-center space-x-3 text-sm">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      <span className="text-slate-900/70">{format(new Date(Date.now() - 600000), "MMM d, yyyy HH:mm")}</span>
                      <span className="text-slate-900">Jobs</span>
                      <span className="text-purple-600">Job scheduler activated - Daily cleanup at 2 AM</span>
                    </div>
                  </div>
                  <div className="text-center py-4 text-slate-900/50">
                    Real-time system monitoring active
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Detail Dialog */}
      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="bg-white border-slate-200 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900">{selectedJob.title}</DialogTitle>
              <DialogDescription className="text-slate-900/70">
                {selectedJob.company} • {selectedJob.location}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-900/70">Status:</span>
                  <Badge className={`ml-2 ${getStatusConfig(selectedJob.status).color}`}>
                    {getStatusConfig(selectedJob.status).label}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-900/70">Active:</span>
                  <Badge className={`ml-2 ${selectedJob.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {selectedJob.isActive ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="text-slate-900/70">
                  Applications: <span className="text-slate-900">{selectedJob.applicationCount}</span>
                </div>
                <div className="text-slate-900/70">
                  Posted: <span className="text-slate-900">{format(new Date(selectedJob.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-900/70">Posted by:</span>
                <span className="text-slate-900 ml-2">
                  {selectedJob.postedBy.firstName} {selectedJob.postedBy.lastName} ({selectedJob.postedBy.username})
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setSelectedJob(null)}
                className="border-slate-200 text-slate-900 hover:bg-slate-100"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Application Detail Dialog */}
      {selectedApplication && (
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="bg-white border-slate-200 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900">{selectedApplication.fullName}</DialogTitle>
              <DialogDescription className="text-slate-900/70">
                Application for {selectedApplication.job.title} at {selectedApplication.job.company}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-slate-900/70">
                  Email: <span className="text-slate-900">{selectedApplication.email}</span>
                </div>
                <div className="text-slate-900/70">
                  Phone: <span className="text-slate-900">{selectedApplication.phone}</span>
                </div>
                <div className="text-slate-900/70">
                  Status: 
                  <Badge className={`ml-2 ${getStatusConfig(selectedApplication.status).color}`}>
                    {getStatusConfig(selectedApplication.status).label}
                  </Badge>
                </div>
                <div className="text-slate-900/70">
                  Applied: <span className="text-slate-900">{format(new Date(selectedApplication.appliedAt), "MMM d, yyyy")}</span>
                </div>
              </div>
              {selectedApplication.coverLetter && (
                <div>
                  <span className="text-slate-900/70 block mb-2">Cover Letter:</span>
                  <div className="bg-slate-100 p-3 rounded text-slate-900 text-sm max-h-32 overflow-y-auto">
                    {selectedApplication.coverLetter}
                  </div>
                </div>
              )}
              {selectedApplication.notes && (
                <div>
                  <span className="text-slate-900/70 block mb-2">Recruiter Notes:</span>
                  <div className="bg-slate-100 p-3 rounded text-slate-900 text-sm">
                    {selectedApplication.notes}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setSelectedApplication(null)}
                className="border-slate-200 text-slate-900 hover:bg-slate-100"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
