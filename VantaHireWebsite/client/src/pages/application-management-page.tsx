import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  FileText,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  UserCheck,
  MessageSquare,
  Filter,
  Search,
  Briefcase,
  Target,
  Mail,
  Star,
  History,
  ArrowLeft,
  FileDown,
  Plus,
  ArrowUpDown,
  Sparkles,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Job, Application, PipelineStage, EmailTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formsApi, type FormTemplateDTO } from "@/lib/formsApi";
import Layout from "@/components/Layout";
import { CandidateIntakeForm } from "@/components/candidate-intake";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormsModal } from "@/components/FormsModal";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { BulkActionBar } from "@/components/kanban/BulkActionBar";
import { ApplicationDetailPanel } from "@/components/kanban/ApplicationDetailPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PageHeaderSkeleton, FilterBarSkeleton, KanbanBoardSkeleton } from "@/components/skeletons";
import { JobSubNav } from "@/components/JobSubNav";

export default function ApplicationManagementPage() {
  const [match, params] = useRoute("/jobs/:id/applications");
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedApplications, setSelectedApplications] = useState<number[]>([]);
  const [stageFilter, setStageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [sortBy, setSortBy] = useState<'date' | 'ai_fit'>('date'); // AI Fit Sorting
  const [fitLabelFilter, setFitLabelFilter] = useState<string[]>([]); // AI Fit Label Filter
  const [isVisible, setIsVisible] = useState(false);

  // ATS features state
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [newRecruiterNote, setNewRecruiterNote] = useState("");
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [addCandidateModalOpen, setAddCandidateModalOpen] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });
  const [showBulkFormsDialog, setShowBulkFormsDialog] = useState(false);
  const [bulkFormId, setBulkFormId] = useState<number | null>(null);
  const [bulkFormMessage, setBulkFormMessage] = useState("");
  const [bulkFormsProgress, setBulkFormsProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showFormsDialog, setShowFormsDialog] = useState(false);
  const [showBatchInterviewDialog, setShowBatchInterviewDialog] = useState(false);
  const [batchInterviewDate, setBatchInterviewDate] = useState("");
  const [batchInterviewTime, setBatchInterviewTime] = useState("");
  const [batchIntervalHours, setBatchIntervalHours] = useState("0");
  const [batchLocation, setBatchLocation] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchStageId, setBatchStageId] = useState<string>("");
  const [showShareShortlistDialog, setShowShareShortlistDialog] = useState(false);
  const [shortlistTitle, setShortlistTitle] = useState("");
  const [shortlistMessage, setShortlistMessage] = useState("");
  const [shortlistExpiresAt, setShortlistExpiresAt] = useState("");
  const [shortlistUrl, setShortlistUrl] = useState<string | null>(null);

  type JobShortlistSummary = {
    id: number;
    title: string | null;
    message: string | null;
    createdAt: string;
    expiresAt: string | null;
    status: string;
    client: { id: number; name: string } | null;
    candidateCount: number;
    publicUrl: string;
    fullUrl: string;
  };

  const jobId = params?.id ? parseInt(params.id) : null;

  // Fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if not recruiter or admin
  if (!user || !['recruiter', 'admin'].includes(user.role)) {
    return <Redirect to="/auth" />;
  }

  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch job");
      return response.json();
    },
    enabled: !!jobId,
  });

  const { data: rawShortlists } = useQuery<JobShortlistSummary[]>({
    queryKey: ["/api/jobs", jobId, "client-shortlists"],
    queryFn: async () => {
      if (!jobId) return [];
      const response = await fetch(`/api/jobs/${jobId}/client-shortlists`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch client shortlists");
      return response.json();
    },
    enabled: !!jobId && !!job?.clientId,
  });
  const shortlists: JobShortlistSummary[] = Array.isArray(rawShortlists) ? rawShortlists : [];

  const { data: applications, isLoading: applicationsLoading } = useQuery<Application[]>({
    queryKey: ["/api/jobs", jobId, "applications"],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}/applications`);
      if (!response.ok) throw new Error("Failed to fetch applications");
      return response.json();
    },
    enabled: !!jobId,
  });

  // ATS: Fetch pipeline stages
  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
    queryFn: async () => {
      const response = await fetch("/api/pipeline/stages");
      if (!response.ok) throw new Error("Failed to fetch pipeline stages");
      return response.json();
    },
  });

  // ATS: Fetch email templates
  const { data: emailTemplates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
    queryFn: async () => {
      const response = await fetch("/api/email-templates");
      if (!response.ok) throw new Error("Failed to fetch email templates");
      return response.json();
    },
  });

  // ATS: Fetch form templates
  const { data: formTemplates = [] } = useQuery<FormTemplateDTO[]>({
    queryKey: ["/api/forms/templates"],
    queryFn: async () => {
      const result = await formsApi.listTemplates();
      return result.templates;
    },
  });

  // ATS: Fetch stage history for selected application
  const { data: stageHistory = [] } = useQuery({
    queryKey: ["/api/applications", selectedApp?.id, "history"],
    queryFn: async () => {
      const response = await fetch(`/api/applications/${selectedApp?.id}/history`);
      if (!response.ok) throw new Error("Failed to fetch stage history");
      return response.json();
    },
    enabled: !!selectedApp?.id && showHistoryDialog,
  });

  // ATS: Auto-select an Interview stage in the batch interview dialog (if available)
  useEffect(() => {
    if (!showBatchInterviewDialog || batchStageId || pipelineStages.length === 0) {
      return;
    }

    // Prefer the earliest "Interview" stage by order if multiple exist
    const sortedStages = [...pipelineStages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const interviewStage = sortedStages.find((stage) =>
      stage.name.toLowerCase().includes("interview")
    );

    if (interviewStage) {
      setBatchStageId(interviewStage.id.toString());
    }
  }, [showBatchInterviewDialog, batchStageId, pipelineStages]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status, notes }: { applicationId: number; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/status`, {
        status,
        notes
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      toast({
        title: "Status updated",
        description: "Application status has been updated successfully.",
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

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ applicationIds, status, notes }: { applicationIds: number[]; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", "/api/applications/bulk", {
        applicationIds,
        status,
        notes
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      setSelectedApplications([]);
      toast({
        title: "Bulk update successful",
        description: `${data.updatedCount} applications updated successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markViewedMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/view`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
    },
  });

  const markDownloadedMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/download`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      toast({
        title: "Download tracked",
        description: "Resume download has been recorded.",
      });
    },
  });

  // ATS: Update application stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ applicationId, stageId, notes }: { applicationId: number; stageId: number; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/stage`, {
        stageId,
        notes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      toast({
        title: "Stage updated",
        description: "Application moved to new stage successfully.",
      });
    },
  });

  // ATS: Schedule interview mutation
  const scheduleInterviewMutation = useMutation({
    mutationFn: async ({ applicationId, date, time, location, notes }: {
      applicationId: number;
      date: string;
      time: string;
      location: string;
      notes?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/interview`, {
        date,
        time,
        location,
        notes,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      setShowInterviewDialog(false);
      setInterviewDate("");
      setInterviewTime("");
      setInterviewLocation("");
      setInterviewNotes("");
      toast({
        title: "Interview scheduled",
        description: "Interview has been scheduled successfully.",
      });
    },
  });

  const createShortlistMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !job?.clientId || selectedApplications.length === 0) {
        throw new Error("Missing job, client, or applications");
      }
      const payload: {
        clientId: number;
        jobId: number;
        title?: string;
        message?: string;
        applicationIds: number[];
        expiresAt?: string;
      } = {
        clientId: job.clientId,
        jobId,
        applicationIds: selectedApplications,
      };
      if (shortlistTitle.trim()) payload.title = shortlistTitle.trim();
      if (shortlistMessage.trim()) payload.message = shortlistMessage.trim();
      if (shortlistExpiresAt) payload.expiresAt = new Date(shortlistExpiresAt).toISOString();

      const res = await apiRequest("POST", "/api/client-shortlists", payload);
      return await res.json();
    },
    onSuccess: (data: { publicUrl?: string; fullUrl?: string }) => {
      const url = data.fullUrl || data.publicUrl || "";
      setShortlistUrl(url || null);
      toast({
        title: "Shortlist Created",
        description: "Share this link with your client to review candidates.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Shortlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ATS: Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({ applicationId, templateId }: { applicationId: number; templateId: number }) => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/send-email`, {
        templateId,
      });
      return await res.json();
    },
    onSuccess: () => {
      setShowEmailDialog(false);
      setSelectedTemplateId(null);
      toast({
        title: "Email sent",
        description: "Email has been sent successfully.",
      });
    },
  });

  // ATS: Send bulk emails mutation
  const sendBulkEmailsMutation = useMutation({
    mutationFn: async ({ applicationIds, templateId }: { applicationIds: number[]; templateId: number }) => {
      let success = 0;
      let failed = 0;
      setBulkProgress({ sent: 0, total: applicationIds.length });
      for (const id of applicationIds) {
        try {
          const res = await apiRequest("POST", `/api/applications/${id}/send-email`, { templateId });
          await res.json();
          success++;
        } catch (_) {
          failed++;
        } finally {
          setBulkProgress((p) => ({ sent: Math.min(p.sent + 1, applicationIds.length), total: applicationIds.length }));
        }
      }
      return { summary: { total: applicationIds.length, success, failed } };
    },
    onSuccess: ({ summary }) => {
      setShowBulkEmailDialog(false);
      setBulkTemplateId(null);
      setSelectedApplications([]);
      setBulkProgress({ sent: 0, total: 0 });
      toast({
        title: "Bulk email sent",
        description: `Sent: ${summary.success}, Failed: ${summary.failed}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk email failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ATS: Send bulk forms mutation (client fan-out)
  const sendBulkFormsMutation = useMutation({
    mutationFn: async ({ applicationIds, formId, customMessage }: { applicationIds: number[]; formId: number; customMessage?: string }) => {
      let created = 0;
      let duplicate = 0;
      let unauthorized = 0;
      let failed = 0;
      setBulkFormsProgress({ sent: 0, total: applicationIds.length });

      for (const appId of applicationIds) {
        try {
          await formsApi.createInvitation({
            applicationId: appId,
            formId,
            ...(customMessage && { customMessage })
          });
          created++;
        } catch (err: any) {
          // Categorize errors by status code
          if (err.status === 409 || (err.message && err.message.includes('already been sent'))) {
            duplicate++;
          } else if (err.status === 403 || (err.message && err.message.includes('Unauthorized'))) {
            unauthorized++;
          } else {
            failed++;
          }
        } finally {
          setBulkFormsProgress(p => ({
            sent: Math.min(p.sent + 1, applicationIds.length),
            total: applicationIds.length
          }));
        }
      }

      return { summary: { total: applicationIds.length, created, duplicate, unauthorized, failed } };
    },
    onSuccess: ({ summary }) => {
      setShowBulkFormsDialog(false);
      setBulkFormId(null);
      setBulkFormMessage("");
      setSelectedApplications([]);
      setBulkFormsProgress({ sent: 0, total: 0 });
      toast({
        title: "Bulk forms sent",
        description: `Created: ${summary.created}, Duplicates: ${summary.duplicate}, Failed: ${summary.failed}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk forms failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ATS: Batch interview scheduling mutation
  const batchInterviewMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Invalid job id");
      const interval = parseFloat(batchIntervalHours || "0");
      const startIso = batchInterviewDate && batchInterviewTime
        ? new Date(`${batchInterviewDate}T${batchInterviewTime}`).toISOString()
        : new Date(batchInterviewDate).toISOString();

      const res = await apiRequest("PATCH", "/api/applications/bulk/interview", {
        applicationIds: selectedApplications,
        start: startIso,
        intervalHours: interval,
        location: batchLocation,
        timeRangeLabel: interval === 0 && batchInterviewTime
          ? batchInterviewTime
          : undefined,
        notes: batchNotes || undefined,
        stageId: batchStageId ? parseInt(batchStageId, 10) : undefined,
      });
      return await res.json();
    },
    onSuccess: (data: { total: number; scheduledCount: number; failedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      setShowBatchInterviewDialog(false);
      setBatchInterviewDate("");
      setBatchInterviewTime("");
      setBatchIntervalHours("0");
      setBatchLocation("");
      setBatchNotes("");
      setBatchStageId("");
      toast({
        title: "Batch interviews scheduled",
        description: `${data.scheduledCount} of ${data.total} candidates scheduled.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Batch scheduling failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ATS: Add recruiter note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ applicationId, note }: { applicationId: number; note: string }) => {
      const res = await apiRequest("POST", `/api/applications/${applicationId}/notes`, {
        note,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      setNewRecruiterNote("");
      toast({
        title: "Note added",
        description: "Recruiter note has been added successfully.",
      });
    },
  });

  // ATS: Set rating mutation
  const setRatingMutation = useMutation({
    mutationFn: async ({ applicationId, rating }: { applicationId: number; rating: number }) => {
      const res = await apiRequest("PATCH", `/api/applications/${applicationId}/rating`, {
        rating,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "applications"] });
      toast({
        title: "Rating updated",
        description: "Candidate rating has been updated successfully.",
      });
    },
  });

  const handleStatusUpdate = (applicationId: number, status: string, notes?: string) => {
    updateStatusMutation.mutate({
      applicationId,
      status,
      ...(notes !== undefined && { notes })
    });
  };

  const handleResumeDownload = (application: Application) => {
    // Use secure, permission-gated endpoint
    window.open(`/api/applications/${application.id}/resume`, '_blank');
    // Track download for analytics/status (server also marks for recruiter/admin)
    markDownloadedMutation.mutate(application.id);
  };

  const handleApplicationView = (applicationId: number) => {
    markViewedMutation.mutate(applicationId);
  };

  // Kanban-specific handlers
  const handleToggleSelect = (id: number) => {
    setSelectedApplications((prev) =>
      prev.includes(id) ? prev.filter((appId) => appId !== id) : [...prev, id]
    );
  };

  const handleOpenDetails = (application: Application) => {
    setSelectedApp(application);
    handleApplicationView(application.id);
  };

  const handleCloseDetails = () => {
    setSelectedApp(null);
  };

  const handleDragCancel = () => {
    toast({
      title: "Drag cancelled",
      description: "Drop onto a stage column to move the application.",
    });
  };

  const handleDragEnd = async (applicationId: number, targetStageId: number) => {
    // Optimistic update
    const previousApplications = applications;

    queryClient.setQueryData(["/api/jobs", jobId, "applications"], (old: Application[] | undefined) => {
      if (!old) return old;
      return old.map((app) =>
        app.id === applicationId ? { ...app, currentStage: targetStageId } : app
      );
    });

    try {
      await updateStageMutation.mutateAsync({
        applicationId,
        stageId: targetStageId
      });
    } catch (error) {
      // Revert on error
      queryClient.setQueryData(["/api/jobs", jobId, "applications"], previousApplications);
      toast({
        title: "Move failed",
        description: "Failed to move application. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBulkMoveStage = async (stageId: number) => {
    if (selectedApplications.length === 0) {
      toast({
        title: "No applications selected",
        description: "Please select applications first.",
        variant: "destructive",
      });
      return;
    }

    let success = 0;
    let failed = 0;
    const total = selectedApplications.length;

    setBulkProgress({ sent: 0, total });

    // Process with concurrency limit of 3
    const concurrencyLimit = 3;
    for (let i = 0; i < selectedApplications.length; i += concurrencyLimit) {
      const batch = selectedApplications.slice(i, i + concurrencyLimit);
      await Promise.allSettled(
        batch.map(async (id) => {
          try {
            await updateStageMutation.mutateAsync({ applicationId: id, stageId });
            success++;
          } catch {
            failed++;
          } finally {
            setBulkProgress((p) => ({ sent: Math.min(p.sent + 1, total), total }));
          }
        })
      );
    }

    setBulkProgress({ sent: 0, total: 0 });
    setSelectedApplications([]);

    toast({
      title: "Bulk move complete",
      description: `Moved: ${success}, Failed: ${failed}`,
    });
  };

  const handleBulkSendEmails = async (templateId: number) => {
    await sendBulkEmailsMutation.mutateAsync({
      applicationIds: selectedApplications,
      templateId,
    });
  };

  const handleBulkSendForms = async (formId: number, message: string) => {
    await sendBulkFormsMutation.mutateAsync({
      applicationIds: selectedApplications,
      formId,
      ...(message && { customMessage: message })
    });
  };

  const handleClearSelection = () => {
    setSelectedApplications([]);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      // Select all filtered applications
      setSelectedApplications(filteredApplications.map(app => app.id));
    } else {
      setSelectedApplications([]);
    }
  };

  // Archive (uses bulk status update to mark as rejected with archive note)
  const handleArchiveSelected = async () => {
    if (selectedApplications.length === 0) return;
    await bulkUpdateMutation.mutateAsync({
      applicationIds: selectedApplications,
      status: 'rejected',
      notes: '[Archived via bulk action]'
    });
  };

  const handleMoveStageFromPanel = (stageId: number, notes?: string) => {
    if (!selectedApp) return;
    updateStageMutation.mutate({
      applicationId: selectedApp.id,
      stageId,
      ...(notes && { notes }),
    });
  };

  const handleScheduleInterviewFromPanel = (data: {
    date: string;
    time: string;
    location: string;
    notes: string;
  }) => {
    if (!selectedApp) return;
    scheduleInterviewMutation.mutate({
      applicationId: selectedApp.id,
      ...data,
    });
  };

  const handleSendEmailFromPanel = (templateId: number) => {
    if (!selectedApp) return;
    sendEmailMutation.mutate({
      applicationId: selectedApp.id,
      templateId,
    });
  };

  const handleSendFormFromPanel = (formId: number, message: string) => {
    if (!selectedApp) return;
    formsApi.createInvitation({
      applicationId: selectedApp.id,
      formId,
      ...(message && { customMessage: message })
    }).then(() => {
      toast({
        title: "Invitation sent",
        description: "Form invitation has been sent successfully.",
      });
    }).catch((error) => {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
    });
  };

  const handleAddNoteFromPanel = (note: string) => {
    if (!selectedApp) return;
    addNoteMutation.mutate({
      applicationId: selectedApp.id,
      note,
    });
  };

  const handleSetRatingFromPanel = (rating: number) => {
    if (!selectedApp) return;
    setRatingMutation.mutate({
      applicationId: selectedApp.id,
      rating,
    });
  };

  const handleDownloadResumeFromPanel = () => {
    if (!selectedApp) return;
    handleResumeDownload(selectedApp);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      submitted: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
      reviewed: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Eye },
      shortlisted: { color: "bg-green-50 text-green-700 border-green-200", icon: UserCheck },
      rejected: { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
      downloaded: { color: "bg-purple-50 text-purple-700 border-purple-200", icon: Download },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.submitted;
    const Icon = config.icon;

    return (
      <Badge variant="secondary" className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredApplications = applications?.filter(app => {
    const matchesStage = stageFilter === 'all' ||
                         (stageFilter === 'unassigned' && app.currentStage == null) ||
                         (stageFilter !== 'unassigned' && app.currentStage === parseInt(stageFilter));
    const matchesSearch = searchQuery === '' ||
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase());
    // AI Fit Label Filter
    const matchesFitLabel = fitLabelFilter.length === 0 ||
      (app.aiFitLabel && fitLabelFilter.includes(app.aiFitLabel));
    return matchesStage && matchesSearch && matchesFitLabel;
  }).sort((a, b) => {
    // AI Fit Sorting
    if (sortBy === 'ai_fit') {
      const scoreA = a.aiFitScore || 0;
      const scoreB = b.aiFitScore || 0;
      return scoreB - scoreA; // Higher scores first
    }
    // Default: Sort by date (newest first)
    return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
  }) || [];

  // Visible apps for current tab (used by Select All)
  const getVisibleApplications = (): Application[] => {
    if (!applications) return [];
    if (selectedTab === 'all') return filteredApplications;
    if (selectedTab === 'unassigned') return getApplicationsWithoutStage();
    if (selectedTab.startsWith('stage-')) {
      const sid = parseInt(selectedTab.split('-')[1] || '0');
      return getApplicationsByStage(sid);
    }
    return [];
  };

  const getApplicationsByStage = (stageId: number) => {
    return applications?.filter(app => app.currentStage === stageId) || [];
  };

  const getApplicationsWithoutStage = () => {
    // Explicitly check for null/undefined (stage IDs start from 1, but be defensive)
    return applications?.filter(app => app.currentStage == null) || [];
  };


  if (jobLoading || applicationsLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto space-y-6 pt-8">
            <PageHeaderSkeleton />
            <Card className="shadow-sm">
              <CardHeader>
                <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-slate-200 rounded animate-pulse mt-2" />
              </CardHeader>
            </Card>
            <FilterBarSkeleton />
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4">
              <KanbanBoardSkeleton columns={5} />
            </div>
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
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <div className="flex items-center gap-3 pt-8 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/my-jobs")}
              className="text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Back to My Jobs</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>

          {/* Job-Level Sub Navigation */}
          <JobSubNav jobId={jobId!} jobTitle={job.title} className="mb-6" />

          {/* Quick Actions Toolbar */}
          <div className="flex flex-col md:flex-row justify-end gap-4 mb-6">

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedApplications.length === 0) {
                    toast({
                      title: "No candidates selected",
                      description: "Select candidates using the checkboxes first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedApplications.length > 20) {
                    const ok = window.confirm(
                      `You are about to email ${selectedApplications.length} candidates. Proceed?`
                    );
                    if (!ok) return;
                  }
                  setShowBulkEmailDialog(true);
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Bulk Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedApplications.length === 0) {
                    toast({
                      title: "No candidates selected",
                      description: "Select candidates using the checkboxes first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (selectedApplications.length > 20) {
                    const ok = window.confirm(
                      `You are about to send forms to ${selectedApplications.length} candidates. Proceed?`
                    );
                    if (!ok) return;
                  }
                  setShowBulkFormsDialog(true);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Bulk Form
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedApplications.length === 0) {
                    toast({
                      title: "No candidates selected",
                      description: "Select candidates using the checkboxes first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!job?.clientId) {
                    toast({
                      title: "No client linked",
                      description: "Set a client for this job before sharing a shortlist.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowShareShortlistDialog(true);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Share with Client
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedApplications.length === 0) {
                    toast({
                      title: "No candidates selected",
                      description: "Select candidates using the checkboxes first.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setShowBatchInterviewDialog(true);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Batch Interview
              </Button>
              <Button size="sm" onClick={() => setAddCandidateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Candidate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => alert("Export feature coming soon")}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-7 w-7 text-primary" />
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
                Application Management
              </h1>
            </div>
            <p className="text-slate-500 text-sm md:text-base max-w-2xl">
              Review and manage applications for "{job.title}"
            </p>
          </div>

          {/* Job Header */}
          <Card className="mb-4 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 text-xl">{job.title}</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Posted {formatDate(job.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {applications?.length || 0} Applications
                  </span>
                </div>
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Client Shortlists Summary */}
          {job.clientId && (
            <Card className="mb-6 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Client Shortlists
                </CardTitle>
                <CardDescription className="text-slate-500 text-sm">
                  Links shared with your client for this role.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {shortlists.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No shortlists created yet. Select candidates and use{" "}
                    <span className="font-medium">Share with Client</span> to
                    generate a shortlist.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {shortlists.map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border border-slate-200 rounded-md p-3 bg-slate-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {s.title || job.title}
                            </span>
                            <Badge className="text-xs bg-slate-100 text-slate-700 border-slate-200">
                              {s.candidateCount} candidate
                              {s.candidateCount === 1 ? "" : "s"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Created{" "}
                            {new Date(s.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {s.expiresAt && (
                              <>
                                {" "}
                                · Expires{" "}
                                {new Date(s.expiresAt).toLocaleDateString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {s.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(s.fullUrl, "_blank")}
                          >
                            Open Link
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sort & Filter Controls */}
          <Card className="mb-6 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-slate-600" />
                  <Label htmlFor="sort-select" className="text-sm font-medium text-slate-700">
                    Sort by:
                  </Label>
                  <Select value={sortBy} onValueChange={(value: 'date' | 'ai_fit') => setSortBy(value)}>
                    <SelectTrigger id="sort-select" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Newest First</SelectItem>
                      <SelectItem value="ai_fit">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI Fit Score
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stage Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <Label htmlFor="stage-filter" className="text-sm font-medium text-slate-700">
                    Stage:
                  </Label>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger id="stage-filter" className="w-48">
                      <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
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

                {/* AI Fit Label Filter Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium text-slate-700">Filter by AI Fit:</Label>
                  {['Exceptional', 'Strong', 'Good'].map((label) => {
                    const isActive = fitLabelFilter.includes(label);
                    return (
                      <Badge
                        key={label}
                        variant={isActive ? "default" : "outline"}
                        className={`cursor-pointer transition-all ${
                          isActive
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'hover:bg-slate-100'
                        }`}
                        onClick={() => {
                          setFitLabelFilter((prev) =>
                            isActive
                              ? prev.filter((l) => l !== label)
                              : [...prev, label]
                          );
                        }}
                      >
                        {isActive && <Sparkles className="h-3 w-3 mr-1" />}
                        {label}
                      </Badge>
                    );
                  })}
                  {fitLabelFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setFitLabelFilter([])}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* Results Count */}
                <div className="ml-auto text-sm text-slate-600">
                  {filteredApplications.length} of {applications?.length || 0} applications
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kanban Board Section */}
          <BulkActionBar
            selectedCount={selectedApplications.length}
            totalCount={filteredApplications.length}
            pipelineStages={pipelineStages}
            emailTemplates={emailTemplates}
            formTemplates={formTemplates}
            onMoveStage={handleBulkMoveStage}
            onSendEmails={handleBulkSendEmails}
            onSendForms={handleBulkSendForms}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onArchiveSelected={handleArchiveSelected}
            isBulkProcessing={sendBulkEmailsMutation.isPending || sendBulkFormsMutation.isPending || bulkUpdateMutation.isPending}
            bulkProgress={bulkProgress}
          />

          <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border border-slate-200 bg-white shadow-sm">
            <ResizablePanel defaultSize={selectedApp ? 70 : 100} minSize={40}>
              <div className="h-full p-4 overflow-auto">
                <KanbanBoard
                  applications={applications || []}
                  pipelineStages={pipelineStages.sort((a, b) => a.order - b.order)}
                  selectedIds={selectedApplications}
                  onToggleSelect={handleToggleSelect}
                  onOpenDetails={handleOpenDetails}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                  onQuickMoveStage={(appId, stageId) => {
                    updateStageMutation.mutate({ applicationId: appId, stageId });
                  }}
                  onQuickEmail={(appId) => {
                    const app = applications?.find(a => a.id === appId);
                    if (app) {
                      handleOpenDetails(app);
                      // Switch to email tab would require more state; opening details is sufficient
                    }
                  }}
                  onQuickInterview={(appId) => {
                    const app = applications?.find(a => a.id === appId);
                    if (app) {
                      handleOpenDetails(app);
                    }
                  }}
                  onQuickDownload={(appId) => {
                    window.open(`/api/applications/${appId}/resume`, '_blank');
                  }}
                />
              </div>
            </ResizablePanel>

            {selectedApp && (
              <>
                <ResizableHandle withHandle className="bg-slate-200" />
                <ResizablePanel defaultSize={30} minSize={25} maxSize={50}>
                  <ApplicationDetailPanel
                    application={selectedApp}
                    jobId={jobId!}
                    pipelineStages={pipelineStages}
                    emailTemplates={emailTemplates}
                    formTemplates={formTemplates}
                    stageHistory={stageHistory}
                    onClose={handleCloseDetails}
                    onMoveStage={handleMoveStageFromPanel}
                    onScheduleInterview={handleScheduleInterviewFromPanel}
                    onSendEmail={handleSendEmailFromPanel}
                    onSendForm={handleSendFormFromPanel}
                    onAddNote={handleAddNoteFromPanel}
                    onSetRating={handleSetRatingFromPanel}
                    onDownloadResume={handleDownloadResumeFromPanel}
                    onUpdateStatus={(status: string, notes?: string) => {
                      if (!selectedApp) return;
                      handleStatusUpdate(selectedApp.id, status, notes);
                    }}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>

        {/* ATS Dialogs */}

        {/* Interview Scheduling Dialog */}
        <Dialog key={selectedApp?.id} open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Interview - {selectedApp?.name}</DialogTitle>
              <DialogDescription>
                Set interview details for this candidate
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="text"
                  placeholder="e.g., 10:00 AM - 11:00 AM"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  type="text"
                  placeholder="e.g., Zoom link or office address"
                  value={interviewLocation}
                  onChange={(e) => setInterviewLocation(e.target.value)}
                />
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                />
              </div>
              <Button
                onClick={() =>
                  selectedApp &&
                  scheduleInterviewMutation.mutate({
                    applicationId: selectedApp.id,
                    date: interviewDate,
                    time: interviewTime,
                    location: interviewLocation,
                    notes: interviewNotes,
                  })
                }
                disabled={!interviewDate || !interviewTime || !interviewLocation || scheduleInterviewMutation.isPending}
                className="w-full"
              >
                {scheduleInterviewMutation.isPending ? "Scheduling..." : "Schedule Interview"}
              </Button>

              {/* Download Calendar Invite - show if interview is already scheduled */}
              {selectedApp?.interviewDate && selectedApp?.interviewTime && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-600 mb-2">
                    Interview scheduled for {new Date(selectedApp.interviewDate).toLocaleDateString()} at {selectedApp.interviewTime}
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(`/api/applications/${selectedApp.id}/interview/ics`, '_blank');
                    }}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download Calendar Invite (.ics)
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    Share this file with the interview panel and candidate to add the interview to their calendars
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Email Sending Dialog */}
        <Dialog key={selectedApp?.id} open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Email - {selectedApp?.name}</DialogTitle>
              <DialogDescription>
                Select a template to send to this candidate
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Email Template</Label>
                <Select
                  value={selectedTemplateId?.toString() || ""}
                  onValueChange={(value) => setSelectedTemplateId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name} - {template.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplateId && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Label className="text-sm text-slate-500">Preview</Label>
                  <p className="text-sm text-slate-700 mt-1">
                    {emailTemplates.find(t => t.id === selectedTemplateId)?.body.substring(0, 200)}...
                  </p>
                </div>
              )}
              <Button
                onClick={() =>
                  selectedApp &&
                  selectedTemplateId &&
                  sendEmailMutation.mutate({
                    applicationId: selectedApp.id,
                    templateId: selectedTemplateId,
                  })
                }
                disabled={!selectedTemplateId || sendEmailMutation.isPending}
                className="w-full"
              >
                {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Shortlist Dialog */}
        <Dialog open={showShareShortlistDialog} onOpenChange={setShowShareShortlistDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Shortlist with Client</DialogTitle>
              <DialogDescription>
                Create a client-ready shortlist link for the selected candidates.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Client</Label>
                <p className="text-sm text-slate-700 font-medium">
                  {job?.clientId ? job?.title : "No client linked to this job"}
                </p>
                {!job?.clientId && (
                  <p className="text-xs text-red-600 mt-1">
                    Link a client to this job on the job posting to enable sharing.
                  </p>
                )}
              </div>
              <div>
                <Label>Shortlist Title (Optional)</Label>
                <Input
                  value={shortlistTitle}
                  onChange={(e) => setShortlistTitle(e.target.value)}
                  placeholder={job?.title || "e.g., Frontend Engineer Shortlist"}
                />
              </div>
              <div>
                <Label>Message to Client (Optional)</Label>
                <Textarea
                  value={shortlistMessage}
                  onChange={(e) => setShortlistMessage(e.target.value)}
                  placeholder="Context for this shortlist, expectations, or notes for the client..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Expires At (Optional)</Label>
                <Input
                  type="date"
                  value={shortlistExpiresAt}
                  onChange={(e) => setShortlistExpiresAt(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave blank to keep the shortlist active indefinitely.
                </p>
              </div>

              {shortlistUrl && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                  <Label className="text-xs text-slate-600">Shareable Link</Label>
                  <div className="flex items-center gap-2">
                    <Input value={shortlistUrl} readOnly className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard
                          .writeText(shortlistUrl)
                          .then(() =>
                            toast({
                              title: "Link Copied",
                              description: "Shortlist link copied to clipboard.",
                            })
                          )
                          .catch(() =>
                            toast({
                              title: "Copy Failed",
                              description: "Could not copy the link. Please copy it manually.",
                              variant: "destructive",
                            })
                          );
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowShareShortlistDialog(false);
                  setShortlistUrl(null);
                  setShortlistTitle("");
                  setShortlistMessage("");
                  setShortlistExpiresAt("");
                }}
              >
                Close
              </Button>
              <Button
                onClick={() => createShortlistMutation.mutate()}
                disabled={
                  !job?.clientId ||
                  selectedApplications.length === 0 ||
                  createShortlistMutation.isPending
                }
              >
                {createShortlistMutation.isPending ? "Creating..." : "Create Shortlist"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Email Dialog */}
        <Dialog key={selectedApplications.join(',')} open={showBulkEmailDialog} onOpenChange={setShowBulkEmailDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Bulk Email - {selectedApplications.length} selected</DialogTitle>
              <DialogDescription>
                Choose a template to send to all selected candidates
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200">
                <Checkbox
                  checked={getVisibleApplications().every(a => selectedApplications.includes(a.id)) && getVisibleApplications().length > 0}
                  onCheckedChange={(checked) => {
                    const visible = getVisibleApplications().map(a => a.id);
                    if (checked) {
                      setSelectedApplications(Array.from(new Set([...selectedApplications, ...visible])));
                    } else {
                      setSelectedApplications(selectedApplications.filter(id => !visible.includes(id)));
                    }
                  }}
                />
                <span className="text-sm text-slate-600">Select all in current view</span>
                {selectedApplications.length > 0 && (
                  <button
                    className="text-xs text-slate-500 underline ml-auto hover:text-slate-700"
                    onClick={() => setSelectedApplications([])}
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div>
                <Label>Email Template</Label>
                <Select
                  value={bulkTemplateId?.toString() || ""}
                  onValueChange={(value) => setBulkTemplateId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name} - {template.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bulkTemplateId && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Label className="text-sm text-slate-500">Preview</Label>
                  <p className="text-sm text-slate-700 mt-1">
                    {emailTemplates.find((t) => t.id === bulkTemplateId)?.body.substring(0, 200)}...
                  </p>
                </div>
              )}
              <Button
                onClick={() =>
                  bulkTemplateId &&
                  sendBulkEmailsMutation.mutate({
                    applicationIds: selectedApplications,
                    templateId: bulkTemplateId,
                  })
                }
                disabled={!bulkTemplateId || sendBulkEmailsMutation.isPending}
                className="w-full"
              >
                {sendBulkEmailsMutation.isPending ? "Sending..." : "Send to Selected"}
              </Button>
              {sendBulkEmailsMutation.isPending && (
                <p className="text-xs text-slate-500 text-center">
                  Sending {bulkProgress.sent}/{bulkProgress.total}...
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Forms Dialog */}
        <Dialog key={selectedApplications.join(',')} open={showBulkFormsDialog} onOpenChange={setShowBulkFormsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Bulk Form - {selectedApplications.length} selected</DialogTitle>
              <DialogDescription>
                Choose a form template to send to all selected candidates
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200">
                <Checkbox
                  checked={getVisibleApplications().every(a => selectedApplications.includes(a.id)) && getVisibleApplications().length > 0}
                  onCheckedChange={(checked) => {
                    const visible = getVisibleApplications().map(a => a.id);
                    if (checked) {
                      setSelectedApplications(Array.from(new Set([...selectedApplications, ...visible])));
                    } else {
                      setSelectedApplications(selectedApplications.filter(id => !visible.includes(id)));
                    }
                  }}
                />
                <span className="text-sm text-slate-600">Select all in current view</span>
                {selectedApplications.length > 0 && (
                  <button
                    className="text-xs text-slate-500 underline ml-auto hover:text-slate-700"
                    onClick={() => setSelectedApplications([])}
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div>
                <Label>Form Template</Label>
                <Select
                  value={bulkFormId?.toString() || ""}
                  onValueChange={(value) => setBulkFormId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select form template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                        {template.description && ` - ${template.description.substring(0, 50)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bulkFormId && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Label className="text-sm text-slate-500">Form Info</Label>
                  {(() => {
                    const template = formTemplates.find((t) => t.id === bulkFormId);
                    return template ? (
                      <div className="text-sm text-slate-700 mt-1">
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-slate-600 mt-1">{template.description}</p>
                        )}
                        <p className="text-slate-500 mt-1">
                          {template.fields?.length || 0} question{template.fields?.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
              <div>
                <Label>Custom Message (Optional)</Label>
                <Textarea
                  placeholder="Add a personal message for all selected candidates..."
                  value={bulkFormMessage}
                  onChange={(e) => setBulkFormMessage(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-slate-500 mt-1">
                  This message will be included in the invitation email for all candidates
                </p>
              </div>
              <Button
                onClick={() =>
                  bulkFormId &&
                  sendBulkFormsMutation.mutate({
                    applicationIds: selectedApplications,
                    formId: bulkFormId,
                    ...(bulkFormMessage && { customMessage: bulkFormMessage }),
                  })
                }
                disabled={!bulkFormId || sendBulkFormsMutation.isPending}
                className="w-full"
              >
                {sendBulkFormsMutation.isPending ? "Sending..." : "Send to Selected"}
              </Button>
              {sendBulkFormsMutation.isPending && (
                <p className="text-xs text-slate-500 text-center">
                  Sending {bulkFormsProgress.sent}/{bulkFormsProgress.total}...
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Batch Interview Dialog */}
        <Dialog open={showBatchInterviewDialog} onOpenChange={setShowBatchInterviewDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Batch Interviews</DialogTitle>
              <DialogDescription>
                Schedule interviews for the selected candidates. Use an interval to create back-to-back slots.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-900 text-sm">Date</Label>
                  <Input
                    type="date"
                    value={batchInterviewDate}
                    onChange={(e) => setBatchInterviewDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-slate-900 text-sm">Start time</Label>
                  <Input
                    type="time"
                    value={batchInterviewTime}
                    onChange={(e) => setBatchInterviewTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-900 text-sm">Interval between interviews</Label>
                  <Select
                    value={batchIntervalHours}
                    onValueChange={setBatchIntervalHours}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 hours (same time)</SelectItem>
                      <SelectItem value="0.5">0.5 hours</SelectItem>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="2">2 hours</SelectItem>
                      <SelectItem value="3">3 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-900 text-sm">Move to stage</Label>
                  <Select
                    value={batchStageId}
                    onValueChange={setBatchStageId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Keep current" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id.toString()}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-slate-900 text-sm">Location</Label>
                <Input
                  placeholder="e.g. Zoom link or office address"
                  value={batchLocation}
                  onChange={(e) => setBatchLocation(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-slate-900 text-sm">Notes (optional)</Label>
                <Textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Add any interviewer or candidate instructions..."
                />
              </div>

              <p className="text-xs text-slate-500">
                When an interval is set, each candidate will be scheduled in sequence starting from the selected time.
                Times are based on your browser&apos;s local timezone.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowBatchInterviewDialog(false)}
                disabled={batchInterviewMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => batchInterviewMutation.mutate()}
                disabled={
                  batchInterviewMutation.isPending ||
                  !batchInterviewDate ||
                  !batchLocation ||
                  selectedApplications.length === 0
                }
              >
                {batchInterviewMutation.isPending ? "Scheduling..." : "Schedule Interviews"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stage History Dialog */}
        <Dialog key={selectedApp?.id} open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Stage History - {selectedApp?.name}</DialogTitle>
              <DialogDescription>
                Timeline of all stage changes for this application
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
              {stageHistory.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No stage history available</p>
              ) : (
                stageHistory.map((history: any, idx: number) => {
                  const fromStage = pipelineStages.find(s => s.id === history.fromStage);
                  const toStage = pipelineStages.find(s => s.id === history.toStage);

                  return (
                    <div key={idx} className="flex gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex-shrink-0">
                        <div
                          className="w-3 h-3 rounded-full mt-1"
                          style={{ backgroundColor: toStage?.color || '#6b7280' }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {fromStage && fromStage.color && (
                            <Badge
                              style={{
                                backgroundColor: `${fromStage.color}20`,
                                borderColor: fromStage.color,
                                color: fromStage.color
                              }}
                              className="border text-xs"
                            >
                              {fromStage.name}
                            </Badge>
                          )}
                          <span className="text-slate-400">→</span>
                          {toStage && toStage.color && (
                            <Badge
                              style={{
                                backgroundColor: `${toStage.color}20`,
                                borderColor: toStage.color,
                                color: toStage.color
                              }}
                              className="border text-xs"
                            >
                              {toStage.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(history.changedAt)}
                        </p>
                        {history.notes && (
                          <p className="text-sm text-slate-600 mt-1">{history.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Forms Dialog */}
        {selectedApp && (
          <FormsModal
            key={selectedApp.id}
            open={showFormsDialog}
            onOpenChange={setShowFormsDialog}
            application={selectedApp}
          />
        )}

        {/* Add Candidate Intake Form */}
        {jobId && (
          <CandidateIntakeForm
            jobId={jobId}
            open={addCandidateModalOpen}
            onOpenChange={setAddCandidateModalOpen}
          />
        )}
      </div>
    </Layout>
  );
}
