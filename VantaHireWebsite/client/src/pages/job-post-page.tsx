import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { insertJobSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, X, Briefcase, MapPin, Calendar, FileText, Tag } from "lucide-react";
import { z } from "zod";
import Layout from "@/components/Layout";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";

export default function JobPostPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    location: "",
    type: "full-time" as const,
    description: "",
    deadline: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");

  // Redirect if not authenticated or not a recruiter/admin
  if (!user) {
    return <Redirect to="/auth" />;
  }

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

  const jobMutation = useMutation({
    mutationFn: async (data: typeof formData & { skills: string[] }) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: (job) => {
      toast({
        title: "Job posted successfully!",
        description: `${job.title} has been posted and is now live.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setLocation("/jobs");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to post job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const jobData = {
        ...formData,
        skills,
        deadline: formData.deadline || undefined,
      };

      insertJobSchema.parse(jobData);
      jobMutation.mutate(jobData as any);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0]?.message || "Validation failed",
          variant: "destructive",
        });
      }
    }
  };

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
            Find the perfect candidate for your team
          </p>
        </div>

        {/* Two-column layout: Form + AI Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Job Form - 2/3 width */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Job Details
                </CardTitle>
                <CardDescription>
                  Fill out the information below to create your job posting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Job Title */}
                  <div>
                    <Label htmlFor="title" className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      Job Title *
                    </Label>
                    <Input
                      id="title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </div>

                  {/* Location and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="location" className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        Location *
                      </Label>
                      <Input
                        id="location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        required
                        placeholder="e.g. San Francisco, CA"
                      />
                    </div>

                    <div>
                      <Label htmlFor="type" className="mb-2 block">Job Type *</Label>
                      <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Application Deadline */}
                  <div>
                    <Label htmlFor="deadline" className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      Application Deadline (Optional)
                    </Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  {/* Skills */}
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-slate-500" />
                      Required Skills
                    </Label>

                    <div className="flex gap-2 mb-3">
                      <Input
                        type="text"
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Add a skill..."
                        className="flex-1"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                      />
                      <Button
                        type="button"
                        onClick={handleAddSkill}
                        size="icon"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {skills.map((skill, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-primary/10 text-primary border-primary/20 pl-3 pr-1 py-1"
                          >
                            {skill}
                            <Button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              variant="ghost"
                              size="icon"
                              className="ml-2 p-0 h-4 w-4 hover:bg-red-100 text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Job Description */}
                  <div>
                    <Label htmlFor="description" className="mb-2 block">
                      Job Description *
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      placeholder="Describe the role, responsibilities, requirements, and what makes this opportunity exciting..."
                      className="min-h-[200px]"
                    />
                    <p className="text-sm text-slate-500 mt-1">
                      {formData.description.length}/5000 characters
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/jobs")}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={jobMutation.isPending}
                      className="flex-1"
                    >
                      {jobMutation.isPending ? "Posting Job..." : "Post Job"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* AI Analysis Panel - 1/3 width */}
          <div className="lg:col-span-1">
            <AIAnalysisPanel
              description={formData.description}
              title={formData.title}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
