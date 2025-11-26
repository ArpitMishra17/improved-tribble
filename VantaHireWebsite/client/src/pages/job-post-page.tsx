import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase } from "lucide-react";
import Layout from "@/components/Layout";
import { JobPostingStepper } from "@/components/JobPostingStepper";

export default function JobPostPage() {
  const { user } = useAuth();

  // Redirect if not authenticated
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Check role permissions
  if (!['recruiter', 'admin'].includes(user.role)) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto shadow-sm">
            <CardContent className="p-8 text-center">
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h1>
              <p className="text-slate-500">You need recruiter or admin privileges to post jobs.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 pt-8">
          <div className="flex items-center gap-3 mb-2">
            <Briefcase className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Post a New Job
            </h1>
          </div>
          <p className="text-slate-500 text-sm md:text-base">
            Create your job posting in a few simple steps
          </p>
        </div>

        {/* Job Posting Stepper */}
        <div className="max-w-3xl mx-auto">
          <JobPostingStepper />
        </div>
      </div>
    </Layout>
  );
}
