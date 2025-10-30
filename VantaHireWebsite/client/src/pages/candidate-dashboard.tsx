import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useAIFeatures } from "@/hooks/use-ai-features";
import { Redirect } from "wouter";
import { 
  User, 
  MapPin, 
  Calendar, 
  Eye, 
  Download, 
  Trash2, 
  Edit3, 
  Save, 
  X,
  Plus,
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  UserCheck,
  Linkedin,
  Mail,
  Phone,
  Star,
  Target,
  AlertCircle,
  Sparkles,
  Brain,
  Upload,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UserProfile, Application, Job } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCsrfToken } from "@/lib/csrf";
import Layout from "@/components/Layout";

type ApplicationWithJob = Application & { job: Job };

export default function CandidateDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fitScoring, resumeAdvisor } = useAIFeatures();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: "",
    skills: [] as string[],
    linkedin: "",
    location: "",
  });
  const [newSkill, setNewSkill] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeLabel, setResumeLabel] = useState("");
  const [resumeIsDefault, setResumeIsDefault] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if not authenticated
  if (!user) {
    return <Redirect to="/auth" />;
  }

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      return response.json();
    },
  });

  const { data: applications, isLoading: applicationsLoading } = useQuery<ApplicationWithJob[]>({
    queryKey: ["/api/my-applications"],
    queryFn: async () => {
      const response = await fetch("/api/my-applications");
      if (!response.ok) throw new Error("Failed to fetch applications");
      return response.json();
    },
  });

  const { data: resumes, isLoading: resumesLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/resume"],
    queryFn: async () => {
      const response = await fetch("/api/ai/resume");
      if (!response.ok) throw new Error("Failed to fetch resumes");
      const data = await response.json();
      // Server returns { resumes: [...] }
      return data?.resumes ?? [];
    },
    enabled: resumeAdvisor,
  });

  const { data: aiLimits } = useQuery<any>({
    queryKey: ["/api/ai/limits"],
    queryFn: async () => {
      const response = await fetch("/api/ai/limits");
      if (!response.ok) throw new Error("Failed to fetch AI limits");
      const data = await response.json();
      return data?.limits ?? null;
    },
    enabled: fitScoring,
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = profile ? "PATCH" : "POST";
      const res = await apiRequest(method, "/api/profile", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setEditingProfile(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
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

  const withdrawApplicationMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const res = await apiRequest("DELETE", `/api/applications/${applicationId}/withdraw`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-applications"] });
      toast({
        title: "Application withdrawn",
        description: "Your application has been withdrawn successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const computeFitMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const res = await apiRequest("POST", "/api/ai/match", { applicationId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/limits"] });

      const isCached = data?.fit?.cached === true;
      toast({
        title: isCached ? "Cached fit score" : "Fit score computed",
        description: isCached
          ? "Returned from cache (no quota used)."
          : "AI has analyzed your fit for this position.",
      });
    },
    onError: (error: Error) => {
      // Check if it's a 429 rate limit error
      const is429 = error.message.includes("429");
      toast({
        title: is429 ? "Rate limit exceeded" : "Computation failed",
        description: is429
          ? "Please try again in a minute."
          : error.message,
        variant: "destructive",
      });
    },
  });

  const batchComputeFitMutation = useMutation({
    mutationFn: async (applicationIds: number[]) => {
      const res = await apiRequest("POST", "/api/ai/match/batch", { applicationIds });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/limits"] });

      const cached = data.summary?.cached || 0;
      const successful = data.summary?.successful || 0;
      toast({
        title: "Batch computation complete",
        description: `Computed: ${successful}, Cached: ${cached}`,
      });
    },
    onError: (error: Error) => {
      const is429 = error.message.includes("429");
      toast({
        title: is429 ? "Rate limit exceeded" : "Batch computation failed",
        description: is429
          ? "Please try again in a minute."
          : error.message,
        variant: "destructive",
      });
    },
  });

  const deleteResumeMutation = useMutation({
    mutationFn: async (resumeId: number) => {
      const res = await apiRequest("DELETE", `/api/ai/resume/${resumeId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/resume"] });
      toast({
        title: "Resume deleted",
        description: "Resume has been removed from your library.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditProfile = () => {
    setProfileData({
      bio: profile?.bio || "",
      skills: profile?.skills || [],
      linkedin: profile?.linkedin || "",
      location: profile?.location || "",
    });
    setEditingProfile(true);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !profileData.skills.includes(newSkill.trim())) {
      setProfileData({
        ...profileData,
        skills: [...profileData.skills, newSkill.trim()]
      });
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setProfileData({
      ...profileData,
      skills: profileData.skills.filter(s => s !== skill)
    });
  };

  const handleWithdrawApplication = (applicationId: number) => {
    if (confirm("Are you sure you want to withdraw this application? This action cannot be undone.")) {
      withdrawApplicationMutation.mutate(applicationId);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { color: "bg-blue-500/20 text-blue-300", icon: Clock, label: "Submitted" },
      reviewed: { color: "bg-yellow-500/20 text-yellow-300", icon: Eye, label: "Under Review" },
      shortlisted: { color: "bg-green-500/20 text-green-300", icon: UserCheck, label: "Shortlisted" },
      rejected: { color: "bg-red-500/20 text-red-300", icon: XCircle, label: "Rejected" },
      downloaded: { color: "bg-purple-500/20 text-purple-300", icon: Download, label: "Resume Downloaded" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.submitted;
    const Icon = config.icon;
    
    return (
      <Badge variant="secondary" className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getApplicationStats = () => {
    if (!applications) return { total: 0, pending: 0, shortlisted: 0, rejected: 0 };
    
    return {
      total: applications.length,
      pending: applications.filter(app => ['submitted', 'reviewed', 'downloaded'].includes(app.status)).length,
      shortlisted: applications.filter(app => app.status === 'shortlisted').length,
      rejected: applications.filter(app => app.status === 'rejected').length,
    };
  };

  const stats = getApplicationStats();

  const getFitBadge = (score: number | null, label: string | null) => {
    if (score === null || label === null) return null;

    const colorMap: Record<string, string> = {
      'Exceptional': 'bg-green-500/20 text-green-300 border-green-500/30',
      'Strong': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'Good': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'Partial': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'Low': 'bg-red-500/20 text-red-300 border-red-500/30',
    };

    const colorClass = colorMap[label] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';

    return (
      <Badge variant="outline" className={`${colorClass} font-medium`}>
        <Sparkles className="w-3 h-3 mr-1" />
        {label} ({score})
      </Badge>
    );
  };

  const handleComputeFit = (applicationId: number) => {
    computeFitMutation.mutate(applicationId);
  };

  const handleBatchComputeFit = () => {
    if (!applications) return;
    // Get all applications without fit scores or with stale scores
    const needsCompute = applications
      .filter(app => !app.aiFitScore || app.aiStaleReason)
      .map(app => app.id);

    if (needsCompute.length === 0) {
      toast({
        title: "No applications to compute",
        description: "All applications have fresh fit scores.",
      });
      return;
    }

    batchComputeFitMutation.mutate(needsCompute);
  };

  const handleResumeUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile || !resumeLabel.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a label and select a file.",
        variant: "destructive",
      });
      return;
    }

    if (resumes && resumes.length >= 3) {
      toast({
        title: "Maximum resumes reached",
        description: "Please delete an existing resume before adding a new one.",
        variant: "destructive",
      });
      return;
    }

    setUploadingResume(true);
    try {
      const csrf = await getCsrfToken();
      const formData = new FormData();
      formData.append('label', resumeLabel);
      if (resumeIsDefault) formData.append('isDefault', 'true');
      formData.append('resume', resumeFile);

      const response = await fetch('/api/ai/resume', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/ai/resume"] });
      toast({
        title: "Resume uploaded",
        description: "Your resume has been added to the library.",
      });

      // Reset form
      setResumeFile(null);
      setResumeLabel("");
      setResumeIsDefault(false);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload resume",
        variant: "destructive",
      });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = (resumeId: number) => {
    deleteResumeMutation.mutate(resumeId);
  };

  const ApplicationCard = ({ application }: { application: ApplicationWithJob }) => (
    <Card className="mb-4 bg-white/10 backdrop-blur-sm border-white/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-white text-xl mb-2">{application.job.title}</CardTitle>
            <CardDescription className="text-gray-300">
              <div className="flex items-center gap-4 mb-2">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {application.job.location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {application.job.type}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Applied {formatDate(application.appliedAt)}
                </span>
              </div>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(application.status)}
            {getFitBadge(application.aiFitScore, application.aiFitLabel)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-gray-300 mb-3 line-clamp-2">{application.job.description}</p>

        {/* AI Fit Analysis */}
        {fitScoring && application.aiFitScore !== null && application.aiFitReasons && (
          <div className="mb-3 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border-l-4 border-purple-400">
            <Label className="text-purple-300 font-medium text-sm flex items-center gap-2">
              <Brain className="w-4 h-4" />
              AI Fit Analysis
            </Label>
            <ul className="text-gray-300 text-sm mt-2 space-y-1">
              {(application.aiFitReasons as string[]).slice(0, 3).map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            {application.aiStaleReason && (
              <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Score may be outdated ({application.aiStaleReason})
              </p>
            )}
          </div>
        )}
        
        {application.job.skills && application.job.skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {application.job.skills.map((skill, index) => (
              <Badge key={index} variant="outline" className="border-purple-400/30 text-purple-300">
                {skill}
              </Badge>
            ))}
          </div>
        )}

        {application.coverLetter && (
          <div className="mb-3 p-3 bg-white/5 rounded-lg">
            <Label className="text-white font-medium text-sm">Your Cover Letter</Label>
            <p className="text-gray-300 text-sm mt-1">{application.coverLetter}</p>
          </div>
        )}

        {application.notes && (
          <div className="mb-3 p-3 bg-blue-500/10 rounded-lg border-l-4 border-blue-400">
            <Label className="text-blue-400 font-medium text-sm">Recruiter Feedback</Label>
            <p className="text-gray-300 text-sm mt-1">{application.notes}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {application.lastViewedAt && (
              <span>Viewed: {formatDate(application.lastViewedAt)}</span>
            )}
            {application.downloadedAt && (
              <span>Resume Downloaded: {formatDate(application.downloadedAt)}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {fitScoring && (!application.aiFitScore || application.aiStaleReason) && (
              <Button
                onClick={() => handleComputeFit(application.id)}
                disabled={computeFitMutation.isPending}
                variant="outline"
                size="sm"
                className="border-purple-400/30 text-purple-300 hover:bg-purple-500/10"
              >
                {computeFitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {application.aiStaleReason ? 'Recompute' : 'Compute'} Fit
              </Button>
            )}
            {application.status === 'submitted' && (
              <Button
                onClick={() => handleWithdrawApplication(application.id)}
                variant="outline"
                size="sm"
                className="border-red-400/30 text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (profileLoading || applicationsLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
            <p className="text-white mt-4">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Premium background effects */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1.2s' }}></div>
        
        <div className={`container mx-auto px-4 py-8 relative z-10 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="max-w-6xl mx-auto">
            {/* Premium Header */}
            <div className="mb-12 pt-16">
              <div className="w-20 h-1.5 bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] rounded-full mb-6 animate-slide-right"></div>
              <div className="flex items-center gap-3 mb-4">
                <Target className="h-8 w-8 text-[#7B38FB]" />
                <h1 className="text-4xl md:text-5xl font-bold">
                  <span className="animate-gradient-text">Candidate</span>
                  <span className="text-white ml-3">Dashboard</span>
                </h1>
              </div>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed animate-slide-up" style={{ animationDelay: '0.3s' }}>
                Manage your profile and track your job applications with AI-powered insights
              </p>
            </div>

            {/* Feature Status Banners */}
            {!fitScoring && (
              <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  AI-powered job fit scoring is currently unavailable. You can still view and manage your applications.
                </AlertDescription>
              </Alert>
            )}
            {!resumeAdvisor && (
              <Alert className="mb-6 bg-blue-500/10 border-blue-500/30 text-blue-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  AI resume advisor is currently unavailable. Standard resume uploads are still available.
                </AlertDescription>
              </Alert>
            )}

            {/* AI Limits Display */}
            {fitScoring && aiLimits && (
              <Card className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-sm border-purple-400/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Sparkles className="w-5 h-5 text-purple-300" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">Free AI Fit Computations</h3>
                        <p className="text-gray-300 text-sm">
                          {aiLimits.fitRemainingThisMonth} of {aiLimits.fitLimitPerMonth} remaining this month
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-300">
                        {aiLimits.fitRemainingThisMonth}
                      </div>
                      <div className="text-xs text-gray-400">
                        Used: {aiLimits.fitUsedThisMonth}
                      </div>
                    </div>
                  </div>
                  {aiLimits.fitRemainingThisMonth === 0 && (
                    <div className="mt-3 p-2 bg-yellow-500/10 rounded border-l-4 border-yellow-400">
                      <p className="text-yellow-300 text-sm">
                        You've used all free computations this month. Cached results are still available.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm">Total Applications</p>
                    <p className="text-3xl font-bold text-blue-400">{stats.total}</p>
                  </div>
                  <Briefcase className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm">In Progress</p>
                    <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm">Shortlisted</p>
                    <p className="text-3xl font-bold text-green-400">{stats.shortlisted}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-300 text-sm">Rejected</p>
                    <p className="text-3xl font-bold text-red-400">{stats.rejected}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white/10 border-white/20">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="applications">My Applications ({stats.total})</TabsTrigger>
              <TabsTrigger value="resumes">Resume Library</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white text-2xl">Profile Information</CardTitle>
                      <CardDescription className="text-gray-300">
                        Manage your profile to auto-fill job applications
                      </CardDescription>
                    </div>
                    {!editingProfile && (
                      <Button onClick={handleEditProfile} variant="outline" className="border-white/20 text-white">
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="bio" className="text-white">Bio</Label>
                        <Textarea
                          id="bio"
                          placeholder="Tell us about yourself..."
                          value={profileData.bio}
                          onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div>
                        <Label htmlFor="location" className="text-white">Location</Label>
                        <Input
                          id="location"
                          placeholder="City, Country"
                          value={profileData.location}
                          onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div>
                        <Label htmlFor="linkedin" className="text-white">LinkedIn URL</Label>
                        <Input
                          id="linkedin"
                          placeholder="https://linkedin.com/in/yourprofile"
                          value={profileData.linkedin}
                          onChange={(e) => setProfileData({ ...profileData, linkedin: e.target.value })}
                          className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                        />
                      </div>

                      <div>
                        <Label className="text-white">Skills</Label>
                        <div className="flex gap-2 mb-3">
                          <Input
                            placeholder="Add a skill"
                            value={newSkill}
                            onChange={(e) => setNewSkill(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                            className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                          />
                          <Button onClick={handleAddSkill} variant="outline" size="sm">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profileData.skills.map((skill, index) => (
                            <Badge key={index} variant="outline" className="border-purple-400/30 text-purple-300">
                              {skill}
                              <button
                                onClick={() => handleRemoveSkill(skill)}
                                className="ml-2 text-red-400 hover:text-red-300"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={updateProfileMutation.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Profile
                        </Button>
                        <Button
                          onClick={() => setEditingProfile(false)}
                          variant="outline"
                          className="border-white/20 text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {profile ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <Label className="text-white font-medium">Contact Information</Label>
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2 text-gray-300">
                                  <Mail className="w-4 h-4" />
                                  <span>{user.username}</span>
                                </div>
                                {profile.location && (
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <MapPin className="w-4 h-4" />
                                    <span>{profile.location}</span>
                                  </div>
                                )}
                                {profile.linkedin && (
                                  <div className="flex items-center gap-2 text-gray-300">
                                    <Linkedin className="w-4 h-4" />
                                    <a
                                      href={profile.linkedin}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300"
                                    >
                                      LinkedIn Profile
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {profile.skills && profile.skills.length > 0 && (
                              <div>
                                <Label className="text-white font-medium">Skills</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {profile.skills.map((skill, index) => (
                                    <Badge key={index} variant="outline" className="border-purple-400/30 text-purple-300">
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {profile.bio && (
                            <div>
                              <Label className="text-white font-medium">Bio</Label>
                              <p className="text-gray-300 mt-2">{profile.bio}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-white mb-2">Complete Your Profile</h3>
                          <p className="text-gray-300 mb-4">
                            Add your information to auto-fill job applications and showcase your skills.
                          </p>
                          <Button onClick={handleEditProfile} className="bg-purple-600 hover:bg-purple-700">
                            Create Profile
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="applications" className="mt-6">
              {fitScoring && applications && applications.length > 0 && (
                <div className="mb-4 flex items-center justify-between bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
                  <div>
                    <h3 className="text-white font-medium">AI Fit Scoring</h3>
                    <p className="text-gray-400 text-sm">
                      Compute fit scores for all applications
                    </p>
                  </div>
                  <Button
                    onClick={handleBatchComputeFit}
                    disabled={batchComputeFitMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {batchComputeFitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Compute All Fits
                  </Button>
                </div>
              )}
              {applications && applications.length > 0 ? (
                applications.map(application => (
                  <ApplicationCard key={application.id} application={application} />
                ))
              ) : (
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-8 text-center">
                    <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Applications Yet</h3>
                    <p className="text-gray-300 mb-4">
                      Start applying to jobs to track your progress here.
                    </p>
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      Browse Jobs
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="resumes" className="mt-6">
              {/* Upload Resume Section */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload Resume
                  </CardTitle>
                  <CardDescription className="text-gray-300">
                    Add a resume to your library (max 3). PDF or DOCX format.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleResumeUpload} className="space-y-4">
                    <div>
                      <Label className="text-white">Resume Label *</Label>
                      <Input
                        value={resumeLabel}
                        onChange={(e) => setResumeLabel(e.target.value)}
                        placeholder="e.g., Software Engineer Resume"
                        className="bg-white/5 border-white/20 text-white"
                        required
                      />
                    </div>

                    <div>
                      <Label className="text-white">Resume File * (PDF or DOCX)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                        className="bg-white/5 border-white/20 text-white"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is-default"
                        checked={resumeIsDefault}
                        onChange={(e) => setResumeIsDefault(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="is-default" className="text-white cursor-pointer">
                        Set as default resume
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      disabled={uploadingResume || !resumeFile || !resumeLabel.trim() || (resumes && resumes.length >= 3)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {uploadingResume ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Resume
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Resume List */}
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Your Resumes ({resumes?.length || 0}/3)</CardTitle>
                  <CardDescription className="text-gray-300">
                    Manage your resume library
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resumesLoading ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                      <p className="text-gray-300 mt-2">Loading resumes...</p>
                    </div>
                  ) : resumes && resumes.length > 0 ? (
                    <div className="space-y-3">
                      {resumes.map((resume) => (
                        <div
                          key={resume.id}
                          className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-medium">{resume.label}</h4>
                              {resume.isDefault && (
                                <Badge variant="outline" className="border-green-500/30 text-green-300">
                                  <Star className="w-3 h-3 mr-1 fill-green-300" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm mt-1">
                              Uploaded {new Date(resume.createdAt).toLocaleDateString()}
                              {resume.updatedAt !== resume.createdAt &&
                                ` • Updated ${new Date(resume.updatedAt).toLocaleDateString()}`
                              }
                            </p>
                          </div>
                          <Button
                            onClick={() => handleDeleteResume(resume.id)}
                            disabled={deleteResumeMutation.isPending}
                            variant="outline"
                            size="sm"
                            className="border-red-400/30 text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No Resumes Yet</h3>
                      <p className="text-gray-300">
                        Upload your first resume to use AI-powered fit scoring.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
