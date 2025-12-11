import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Helmet } from "react-helmet-async";
import { MapPin, Clock, Calendar, Users, FileText, Upload, Briefcase, Star, Share2, Bookmark, Sparkles, DollarSign, AlertTriangle, RotateCcw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Job, insertApplicationSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCsrfToken } from "@/lib/csrf";
import { z } from "zod";
import { differenceInDays, format } from "date-fns";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateJobPostingJsonLd, generateJobMetaDescription, getJobCanonicalUrl } from "@/lib/seoHelpers";

// Types for audit log
interface AuditLogEntry {
  id: number;
  action: string;
  changes: Record<string, unknown> | null;
  performedBy: { firstName: string; lastName: string; username: string } | null;
  createdAt: string;
}

export default function JobDetailsPage() {
  const [match, params] = useRoute("/jobs/:id");
  const { toast } = useToast();
  const { user } = useAuth();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    coverLetter: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const jobId = params?.id ? parseInt(params.id) : null;

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const { data: job, isLoading, error } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch job");
      return response.json();
    },
    enabled: !!jobId,
  });

  // Check if AI features are enabled
  const { data: aiFeatures } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/features/ai"],
    queryFn: async () => {
      const response = await fetch("/api/features/ai");
      if (!response.ok) return { enabled: false };
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Check if current user is recruiter/admin (for showing admin features)
  const isRecruiterOrAdmin = user?.role === 'recruiter' || user?.role === 'super_admin';

  // Fetch audit log for job (recruiters/admins only)
  const { data: auditLog = [] } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/jobs", jobId, "audit-log"],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}/audit-log`, { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!jobId && isRecruiterOrAdmin,
  });

  // Job reactivation mutation (for expired jobs)
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/status`, { isActive: true, reason: "Reactivated from job details page" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "audit-log"] });
      toast({ title: "Job reactivated", description: "The job posting is now active again." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reactivate job", description: error.message, variant: "destructive" });
    },
  });

  // Helper functions for expiry status
  const isExpired = job?.expiresAt ? new Date(job.expiresAt) < new Date() : false;
  const daysUntilExpiry = job?.expiresAt ? differenceInDays(new Date(job.expiresAt), new Date()) : null;
  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

  const applicationMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Add CSRF token to FormData
      const csrfToken = await getCsrfToken();

      const response = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: {
          'x-csrf-token': csrfToken,
        },
        body: data,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit application");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Application submitted successfully",
        description: "We'll review your application and get back to you soon.",
      });
      setShowApplicationForm(false);
      setFormData({ name: "", email: "", phone: "", coverLetter: "" });
      setResumeFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resumeFile) {
      toast({
        title: "Resume required",
        description: "Please upload your resume to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      const validatedData = insertApplicationSchema.parse({
        ...formData,
        jobId: jobId!,
      });

      const formDataToSend = new FormData();
      Object.entries(validatedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formDataToSend.append(key, value.toString());
        }
      });
      
      if (resumeFile) {
        formDataToSend.append('resume', resumeFile);
      }

      applicationMutation.mutate(formDataToSend);
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

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'Not set';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!match || !jobId) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-2">Job Not Found</h1>
            <p>The job you're looking for doesn't exist.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
            <p className="text-white mt-4">Loading job details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold mb-2">Error</h1>
            <p>Failed to load job details. Please try again.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Generate SEO metadata and JSON-LD
  const metaDescription = generateJobMetaDescription(job);
  const canonicalUrl = getJobCanonicalUrl(job);
  const jobPostingJsonLd = generateJobPostingJsonLd(job);

  return (
    <Layout>
      <Helmet>
        {/* Page Title and Meta */}
        <title>{job.title} - VantaHire | AI + Human Expertise for Faster, Fairer Hiring</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:title" content={`${job.title} - VantaHire`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${window.location.origin}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta name="twitter:title" content={`${job.title} - VantaHire`} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${window.location.origin}/twitter-image.jpg`} />

        {/* JobPosting JSON-LD for Google Jobs */}
        {jobPostingJsonLd && (
          <script type="application/ld+json">
            {JSON.stringify(jobPostingJsonLd)}
          </script>
        )}
      </Helmet>

      <div className="public-theme min-h-screen">
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1.2s' }}></div>
        
        <div className={`container mx-auto px-4 py-8 relative z-10 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="max-w-4xl mx-auto">
            {/* Premium Header */}
            <div className="mb-12 pt-16">
              <div className="w-20 h-1.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] rounded-full mb-6 animate-slide-right"></div>
              <div className="flex items-center gap-3 mb-4">
                <Briefcase className="h-8 w-8 text-[#7B38FB]" />
                <h1 className="text-4xl md:text-5xl font-bold">
                  <span className="animate-gradient-text">Job</span>
                  <span className="text-white ml-3">Details</span>
                </h1>
              </div>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed animate-slide-up" style={{ animationDelay: '0.3s' }}>
                Explore this opportunity and submit your application
              </p>
            </div>

            {/* Job Header */}
            <Card className="mb-8 bg-white/10 backdrop-blur-sm border-white/20 premium-card animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <div className="mb-4">
                  <CardTitle className="text-3xl font-bold text-white mb-2">
                    {job.title}
                  </CardTitle>
                  <CardDescription className="text-gray-300 text-lg flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Posted {formatDate(job.createdAt)}
                    </span>
                    <Badge
                      variant="secondary"
                      className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-3 py-1 capitalize"
                    >
                      {job.type.replace('-', ' ')}
                    </Badge>
                  </CardDescription>
                </div>

                {job.deadline && (
                  <div className="flex items-center gap-2 text-orange-300">
                    <Calendar className="h-5 w-5" />
                    <span>Application Deadline: {formatDate(job.deadline)}</span>
                  </div>
                )}

                {/* Expired State Badge */}
                {isExpired && (
                  <div className="flex items-center gap-3 mt-4">
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                      Expired
                    </Badge>
                    {isRecruiterOrAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reactivateMutation.mutate()}
                        disabled={reactivateMutation.isPending}
                        className="border-green-500/50 text-green-300 hover:bg-green-500/20"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {reactivateMutation.isPending ? "Reactivating..." : "Reactivate Job"}
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>
            </Card>

            {/* Expiry Warning Banner */}
            {showExpiryWarning && !isExpired && (
              <div className="mb-4 p-4 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-200 font-medium">
                    This job posting expires {daysUntilExpiry === 0 ? 'today' : daysUntilExpiry === 1 ? 'tomorrow' : `in ${daysUntilExpiry} days`}
                  </p>
                  <p className="text-amber-300/70 text-sm">
                    {job.expiresAt && `Expiry date: ${format(new Date(job.expiresAt), "MMMM d, yyyy 'at' h:mm a")}`}
                  </p>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Job Description */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20 premium-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-[#7B38FB]" />
                      Job Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none">
                      <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                        {job.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {job.skills && job.skills.length > 0 && (
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20 premium-card">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Star className="h-5 w-5 text-[#7B38FB]" />
                        Required Skills
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {job.skills.map((skill, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="border-purple-400/30 text-purple-300 bg-purple-400/10"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Application Form */}
              <div className="space-y-6">
                {!showApplicationForm ? (
                    <Card className="bg-white/10 backdrop-blur-sm border-white/20 premium-card sticky top-8">
                      <CardHeader>
                        <CardTitle className="text-white">Job Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Job Metadata */}
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <MapPin className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-gray-400">Location</p>
                              <p className="text-white font-medium">{job.location}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <Briefcase className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-gray-400">Job Type</p>
                              <p className="text-white font-medium capitalize">{job.type.replace('-', ' ')}</p>
                            </div>
                          </div>

                          {job.deadline && (
                            <div className="flex items-start gap-3">
                              <Calendar className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm text-gray-400">Deadline</p>
                                <p className="text-orange-300 font-medium">{formatDate(job.deadline)}</p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-gray-400">Posted</p>
                              <p className="text-white font-medium">{formatDate(job.createdAt)}</p>
                            </div>
                          </div>
                        </div>

                        {/* AI Score Badge - Conditionally shown */}
                        {aiFeatures?.enabled && (
                          <div className="p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-400/30">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-purple-400" />
                              <span className="text-sm font-semibold text-purple-300">AI Match Score</span>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">
                              Upload your resume to see your match score
                            </p>
                            <Badge variant="outline" className="border-purple-400/50 text-purple-300 bg-purple-400/10">
                              AI-Powered Matching Available
                            </Badge>
                          </div>
                        )}

                        {/* Primary CTA */}
                        <div className="space-y-3">
                          <Button
                            onClick={() => setShowApplicationForm(true)}
                            className="w-full bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105"
                            size="lg"
                            data-testid="apply-button"
                          >
                            Apply Now
                          </Button>

                          {/* Secondary Actions */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => {
                                navigator.share?.({
                                  title: job.title,
                                  url: window.location.href
                                }).catch(() => {
                                  navigator.clipboard.writeText(window.location.href);
                                  toast({ title: "Link copied to clipboard" });
                                });
                              }}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </Button>
                            <Button
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/10"
                              onClick={() => toast({ title: "Job saved", description: "We'll remind you about this opportunity" })}
                            >
                              <Bookmark className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="bg-white/10 backdrop-blur-sm border-white/20 premium-card sticky top-8">
                      <CardHeader>
                        <CardTitle className="text-white">Submit Application</CardTitle>
                        <CardDescription className="text-white/70">
                          Fill out the form below to apply for this position
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                          <div>
                            <Label htmlFor="name" className="text-white">Full Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              required
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-[#7B38FB] focus:ring-2 focus:ring-[#7B38FB]/20 transition-all duration-300"
                            />
                          </div>

                          <div>
                            <Label htmlFor="email" className="text-white">Email *</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              required
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-[#7B38FB] focus:ring-2 focus:ring-[#7B38FB]/20 transition-all duration-300"
                            />
                          </div>

                          <div>
                            <Label htmlFor="phone" className="text-white">Phone *</Label>
                            <Input
                              id="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              required
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-[#7B38FB] focus:ring-2 focus:ring-[#7B38FB]/20 transition-all duration-300"
                            />
                          </div>

                          <div>
                            <Label htmlFor="resume" className="text-white">Resume (PDF) *</Label>
                            <div className="relative">
                            <Input
                              id="resume"
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                              required
                              className="bg-white/5 border-white/20 text-white file:bg-purple-500 file:text-white file:border-0 file:rounded file:px-4 file:py-2"
                            />
                              <Upload className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                            {resumeFile && (
                              <p className="text-sm text-green-400 mt-1">
                                Selected: {resumeFile.name}
                              </p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="coverLetter" className="text-white">Cover Letter</Label>
                            <Textarea
                              id="coverLetter"
                              value={formData.coverLetter}
                              onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                              placeholder="Tell us why you're perfect for this role..."
                              rows={4}
                              className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-[#7B38FB] focus:ring-2 focus:ring-[#7B38FB]/20 transition-all duration-300"
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button 
                              type="submit" 
                              disabled={applicationMutation.isPending}
                              className="flex-1 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300"
                            >
                              {applicationMutation.isPending ? "Submitting..." : "Submit Application"}
                            </Button>
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setShowApplicationForm(false)}
                              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                )}
              </div>
            </div>

            {/* Activity Log (Recruiters/Admins only) */}
            {isRecruiterOrAdmin && auditLog.length > 0 && (
              <Card className="mt-8 bg-white/10 backdrop-blur-sm border-white/20 premium-card">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-[#7B38FB]" />
                    Activity Log
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Recent changes and actions on this job posting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/20" />

                    <div className="space-y-4">
                      {auditLog.slice(0, 10).map((entry, index) => (
                        <div key={entry.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className="absolute left-2.5 w-3 h-3 rounded-full bg-[#7B38FB] border-2 border-white/20" />

                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-white capitalize">
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-white/50">
                                {entry.createdAt && !isNaN(new Date(entry.createdAt).getTime())
                                  ? format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")
                                  : 'Unknown date'}
                              </span>
                            </div>
                            {entry.performedBy && (
                              <p className="text-xs text-white/60">
                                by {entry.performedBy.firstName} {entry.performedBy.lastName}
                              </p>
                            )}
                            {entry.changes && Object.keys(entry.changes).length > 0 && (
                              <div className="mt-2 text-xs text-white/50">
                                {Object.entries(entry.changes).map(([key, value]) => (
                                  <span key={key} className="inline-block mr-2">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
