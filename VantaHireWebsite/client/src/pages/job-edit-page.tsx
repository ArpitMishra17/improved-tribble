import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Job } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import { JobSubNav } from "@/components/JobSubNav";
import { PageHeaderSkeleton } from "@/components/skeletons";

export default function JobEditPage() {
  const [match, params] = useRoute("/jobs/:id/edit");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    type: "full-time",
    skills: [] as string[],
  });

  const jobId = params?.id ? parseInt(params.id) : null;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if not recruiter or admin
  if (!user || !['recruiter', 'admin'].includes(user.role)) {
    return <Redirect to="/auth" />;
  }

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch job");
      return response.json();
    },
    enabled: !!jobId,
  });

  // Populate form when job loads
  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title,
        description: job.description,
        location: job.location,
        type: job.type,
        skills: job.skills || [],
      });
    }
  }, [job]);

  const updateJobMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-jobs"] });
      toast({
        title: "Job updated",
        description: "Job details have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateJobMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6 pt-8">
            <PageHeaderSkeleton />
          </div>
        </div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Job Not Found</h3>
              <p className="text-slate-500">The requested job could not be found.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`container mx-auto px-4 py-8 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <div className="flex items-center gap-3 pt-8 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/my-jobs")}
              className="text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Jobs
            </Button>
          </div>

          {/* Job-Level Sub Navigation */}
          <JobSubNav jobId={jobId!} jobTitle={job.title} className="mb-6" />

          {/* Edit Form */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Edit Job Details</CardTitle>
              <CardDescription>Update the job posting information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Job Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full Time</SelectItem>
                      <SelectItem value="part-time">Part Time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={8}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Input
                    id="skills"
                    value={formData.skills.join(", ")}
                    onChange={(e) => setFormData({
                      ...formData,
                      skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="React, TypeScript, Node.js"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={updateJobMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateJobMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
