import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, Briefcase, Plus, Play, Search, Edit, LayoutGrid, CheckCircle, Clock, Archive } from "lucide-react";
import Layout from "@/components/Layout";
import { PageHeaderSkeleton, FilterBarSkeleton, JobListSkeleton } from "@/components/skeletons";
import { SubNav, type SubNavItem } from "@/components/SubNav";
import type { Job } from "@shared/schema";

type JobWithCounts = Job & {
  company?: string;
  applicationCount?: number;
  hiringManager?: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    username: string;
  };
  clientName?: string | null;
};

export default function MyJobsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch recruiter's jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<JobWithCounts[]>({
    queryKey: ["/api/my-jobs"],
  });

  // Compute counts for SubNav
  const activeCount = jobs.filter(j => j.isActive).length;
  const inactiveCount = jobs.filter(j => !j.isActive).length;
  const pendingCount = jobs.filter(j => j.status === 'pending').length;

  const subNavItems: SubNavItem[] = [
    { id: "all", label: "All Jobs", count: jobs.length, icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "active", label: "Active", count: activeCount, icon: <CheckCircle className="h-4 w-4" /> },
    { id: "inactive", label: "Inactive", count: inactiveCount, icon: <Archive className="h-4 w-4" /> },
    { id: "pending", label: "Pending Review", count: pendingCount, icon: <Clock className="h-4 w-4" /> },
  ];

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Filter jobs based on active tab and search
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = !searchQuery ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase());

    // Tab filter takes priority
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && job.isActive) ||
      (activeTab === "inactive" && !job.isActive) ||
      (activeTab === "pending" && job.status === "pending");

    return matchesSearch && matchesTab;
  });

  if (jobsLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6 pt-8">
            <PageHeaderSkeleton />
            <FilterBarSkeleton />
            <JobListSkeleton count={4} />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6 pt-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">My Jobs</h1>
              <p className="text-slate-500 text-sm md:text-base">Manage your job postings, status, and applications</p>
            </div>
            <Button onClick={() => setLocation("/jobs/post")}>
              <Plus className="h-4 w-4 mr-2" />
              Post New Job
            </Button>
          </div>

          {/* Sub Navigation */}
          <SubNav
            items={subNavItems}
            activeId={activeTab}
            onChange={setActiveTab}
            className="rounded-lg"
          />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search by title, company, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Jobs List */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 text-lg">
                Job Postings ({filteredJobs.length})
              </CardTitle>
              <CardDescription>
                Manage your posted job opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-2">
                      {searchQuery || activeTab !== "all"
                        ? "No jobs match your filters"
                        : "No job postings yet"}
                    </p>
                    {!searchQuery && activeTab === "all" && (
                      <Button className="mt-4" onClick={() => setLocation("/jobs/post")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Post Your First Job
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-slate-900 font-medium text-lg">{job.title}</h3>
                          <p className="text-slate-600">{job.company} • {job.location}</p>
                          {job.hiringManager && (
                            <p className="text-slate-500 text-sm mt-1">
                              Hiring Manager: {job.hiringManager.firstName && job.hiringManager.lastName
                                ? `${job.hiringManager.firstName} ${job.hiringManager.lastName}`
                                : job.hiringManager.username}
                            </p>
                          )}
                          {!job.hiringManager && (
                            <p className="text-slate-400 text-sm mt-1">Hiring Manager: —</p>
                          )}
                          <p className="text-slate-500 text-sm mt-1">{job.type}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                          {job.isActive && (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                              Live
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-slate-600 text-sm mb-3 line-clamp-2">{job.description}</p>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 text-sm">
                          {job.applicationCount || 0} applications
                        </span>

                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/jobs/${job.id}/applications`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Applications
                          </Button>
                          {job.status === 'approved' && !job.isActive && (
                            <Button
                              size="sm"
                              onClick={() => publishJobMutation.mutate({ jobId: job.id, isActive: true })}
                              disabled={publishJobMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              {publishJobMutation.isPending ? 'Publishing...' : 'Publish'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
