import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, MessageSquare, Calendar, ArrowRight } from "lucide-react";

interface Job {
  id: number;
  title: string;
  location: string;
  type: string;
  createdAt: Date;
  isActive: boolean;
}

interface Application {
  id: number;
  name: string;
  email: string;
  appliedAt: Date;
  currentStage: number | null;
  jobId: number;
}

interface ApplicationWithJob extends Application {
  jobTitle: string;
}

interface FeedbackCount {
  [applicationId: number]: number;
}

export default function HiringManagerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user || user.role !== 'hiring_manager') {
    return <Redirect to="/auth" />;
  }

  // Fetch all jobs where this user is the hiring manager
  const { data: allJobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/my-jobs"],
    queryFn: async () => {
      const response = await fetch("/api/my-jobs");
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
  });

  // Filter jobs where user is hiring manager
  const myJobs = allJobs.filter((job: any) => job.hiringManagerId === user.id);

  // Fetch applications for each job
  const { data: allApplicationsData } = useQuery({
    queryKey: ["/api/hiring-manager/applications", myJobs.map(j => j.id)],
    queryFn: async () => {
      if (myJobs.length === 0) return [];

      const applicationsPromises = myJobs.map(async (job) => {
        const response = await fetch(`/api/jobs/${job.id}/applications`);
        if (!response.ok) throw new Error(`Failed to fetch applications for job ${job.id}`);
        const apps = await response.json();
        return apps.map((app: Application) => ({
          ...app,
          jobTitle: job.title,
        }));
      });

      const results = await Promise.all(applicationsPromises);
      return results.flat();
    },
    enabled: myJobs.length > 0,
  });

  const allApplications: ApplicationWithJob[] = allApplicationsData || [];

  // Fetch feedback counts for each application
  const { data: feedbackCounts = {} } = useQuery<FeedbackCount>({
    queryKey: ["/api/hiring-manager/feedback-counts", allApplications.map(a => a.id)],
    queryFn: async () => {
      if (allApplications.length === 0) return {};

      const feedbackPromises = allApplications.map(async (app) => {
        try {
          const response = await fetch(`/api/applications/${app.id}/feedback`);
          if (!response.ok) return { appId: app.id, count: 0 };
          const feedback = await response.json();
          // Count feedback from this hiring manager
          const myFeedbackCount = feedback.filter((fb: any) => fb.authorId === user.id).length;
          return { appId: app.id, count: myFeedbackCount };
        } catch {
          return { appId: app.id, count: 0 };
        }
      });

      const results = await Promise.all(feedbackPromises);
      return results.reduce((acc, { appId, count }) => {
        acc[appId] = count;
        return acc;
      }, {} as FeedbackCount);
    },
    enabled: allApplications.length > 0,
  });

  // Applications needing feedback (where hiring manager hasn't given feedback yet)
  const applicationsNeedingFeedback = allApplications.filter(
    (app) => (feedbackCounts[app.id] || 0) === 0
  );

  const handleViewJob = (jobId: number) => {
    setLocation(`/jobs/${jobId}/applications`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Hiring Manager Dashboard
          </h1>
          <p className="text-slate-600">
            Welcome back, {user.firstName || user.username}! Review candidates and provide feedback.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                My Jobs
              </CardTitle>
              <Briefcase className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{myJobs.length}</div>
              <p className="text-xs text-slate-500 mt-1">
                Jobs assigned to you
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Candidates
              </CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{allApplications.length}</div>
              <p className="text-xs text-slate-500 mt-1">
                Across all your jobs
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Awaiting Feedback
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {applicationsNeedingFeedback.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Candidates needing your review
              </p>
            </CardContent>
          </Card>
        </div>

        {/* My Jobs Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            My Jobs
          </h2>

          {jobsLoading ? (
            <p className="text-slate-500">Loading jobs...</p>
          ) : myJobs.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600">No jobs assigned to you yet.</p>
                <p className="text-slate-500 text-sm mt-1">
                  Contact your recruiter to get assigned to job postings.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myJobs.map((job) => {
                const jobApplications = allApplications.filter((app) => app.jobId === job.id);
                const needingFeedback = jobApplications.filter(
                  (app) => (feedbackCounts[app.id] || 0) === 0
                ).length;

                return (
                  <Card key={job.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base text-slate-900">{job.title}</CardTitle>
                          <CardDescription className="text-sm mt-1">
                            {job.location} • {job.type}
                          </CardDescription>
                        </div>
                        {job.isActive && (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Active
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Candidates:</span>
                        <span className="font-medium text-slate-900">{jobApplications.length}</span>
                      </div>
                      {needingFeedback > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Need Feedback:</span>
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            {needingFeedback}
                          </Badge>
                        </div>
                      )}
                      <Button
                        onClick={() => handleViewJob(job.id)}
                        className="w-full mt-2"
                        variant="outline"
                      >
                        View Candidates
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Candidates Awaiting Feedback Section */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-600" />
            Candidates Awaiting Your Feedback
          </h2>

          {applicationsNeedingFeedback.length === 0 ? (
            <Card className="bg-white border-slate-200">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600">All caught up!</p>
                <p className="text-slate-500 text-sm mt-1">
                  You've provided feedback for all candidates.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {applicationsNeedingFeedback.map((app) => (
                <Card key={app.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-slate-900">{app.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {app.jobTitle}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>{app.email}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(app.appliedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleViewJob(app.jobId)}
                        size="sm"
                      >
                        Review
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
