import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertJobSchema, type Client, type Job, type EmailTemplate, type PipelineStage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  X,
  Briefcase,
  MapPin,
  Calendar,
  FileText,
  Tag,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Mail,
  GitBranch,
  Copy,
  Info,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Step validation schemas
const step1Schema = z.object({
  title: z.string().min(3, "Job title must be at least 3 characters"),
  location: z.string().min(2, "Location is required"),
  type: z.enum(["full-time", "part-time", "contract", "remote"]),
  deadline: z.string().optional(),
});

const step2Schema = z.object({
  description: z.string().min(50, "Description must be at least 50 characters"),
  skills: z.array(z.string()).optional(),
});

const step3Schema = z.object({
  hiringManagerId: z.number().optional(),
  clientId: z.number().optional(),
});

interface JobPostingStepperProps {
  onSuccess?: () => void;
}

interface FieldError {
  field: string;
  message: string;
}

const STEPS = [
  { id: 1, title: "Basics", description: "Job title, location & type" },
  { id: 2, title: "Details", description: "Skills & description" },
  { id: 3, title: "Team", description: "Hiring manager & client" },
  { id: 4, title: "Setup", description: "Templates & pipeline" },
];

const DEFAULT_STAGES = [
  { name: "Applied", order: 1, color: "#6b7280" },
  { name: "Screening", order: 2, color: "#3b82f6" },
  { name: "Interview", order: 3, color: "#10b981" },
  { name: "Offer", order: 4, color: "#f59e0b" },
  { name: "Hired", order: 5, color: "#22c55e" },
];

export function JobPostingStepper({ onSuccess }: JobPostingStepperProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<FieldError[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    location: "",
    type: "full-time" as const,
    description: "",
    deadline: "",
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [hiringManagerId, setHiringManagerId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");

  // Setup step state
  const [cloneFromJobId, setCloneFromJobId] = useState<string>("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [useDefaultPipeline, setUseDefaultPipeline] = useState(true);
  const [customStages, setCustomStages] = useState<{ name: string; color: string }[]>([]);
  const [newStageName, setNewStageName] = useState("");

  // Fetch hiring managers
  const { data: hiringManagers = [] } = useQuery<
    Array<{ id: number; username: string; firstName: string | null; lastName: string | null }>
  >({
    queryKey: ["/api/users", { role: "hiring_manager" }],
    queryFn: async () => {
      const response = await fetch("/api/users?role=hiring_manager", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch hiring managers");
      return response.json();
    },
  });

  // Fetch clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch existing jobs for template cloning
  const { data: existingJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/my-jobs"],
    queryFn: async () => {
      const response = await fetch("/api/my-jobs", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
  });

  // Fetch email templates
  const { data: emailTemplates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
    queryFn: async () => {
      const response = await fetch("/api/email-templates", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Fetch existing pipeline stages
  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
    queryFn: async () => {
      const response = await fetch("/api/pipeline/stages", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch stages");
      return response.json();
    },
  });

  // Clone prefill - when a job is selected, prefill form fields
  useEffect(() => {
    if (!cloneFromJobId) return;

    const sourceJob = existingJobs.find(j => j.id.toString() === cloneFromJobId);
    if (!sourceJob) return;

    // Prefill form data with "(Copy)" suffix on title
    setFormData({
      title: `${sourceJob.title} (Copy)`,
      location: sourceJob.location,
      type: sourceJob.type as "full-time" | "part-time" | "contract" | "remote",
      description: sourceJob.description,
      deadline: "",
    });

    // Prefill skills
    if (sourceJob.skills && sourceJob.skills.length > 0) {
      setSkills(sourceJob.skills);
    }

    // Prefill hiring manager and client if set
    if (sourceJob.hiringManagerId) {
      setHiringManagerId(sourceJob.hiringManagerId.toString());
    }
    if (sourceJob.clientId) {
      setClientId(sourceJob.clientId.toString());
    }

    toast({
      title: "Job cloned",
      description: `Prefilled from "${sourceJob.title}". Review and customize as needed.`,
    });
  }, [cloneFromJobId, existingJobs]);

  // Submit mutation with Step 4 setup
  const jobMutation = useMutation({
    mutationFn: async (data: typeof formData & { skills: string[] }) => {
      // Create the job first
      const response = await apiRequest("POST", "/api/jobs", data);
      const job = await response.json();

      // Handle pipeline stage creation
      if (pipelineStages.length === 0) {
        // No stages exist - create either default or custom
        const stagesToCreate = useDefaultPipeline
          ? DEFAULT_STAGES
          : customStages.map((s, i) => ({ name: s.name, color: s.color, order: i + 1 }));

        if (stagesToCreate.length > 0) {
          try {
            for (const stage of stagesToCreate) {
              await apiRequest("POST", "/api/pipeline/stages", stage);
            }
          } catch (e) {
            console.error("Failed to create pipeline stages:", e);
          }
        }
      } else if (!useDefaultPipeline && customStages.length > 0) {
        // Stages exist but user defined custom ones - add the new custom stages
        try {
          const maxOrder = Math.max(...pipelineStages.map(s => s.order), 0);
          for (let i = 0; i < customStages.length; i++) {
            const stage = customStages[i];
            await apiRequest("POST", "/api/pipeline/stages", {
              name: stage.name,
              color: stage.color,
              order: maxOrder + i + 1,
            });
          }
        } catch (e) {
          console.error("Failed to create custom pipeline stages:", e);
        }
      }

      // Link selected email templates to the job (if API supports it)
      // Note: Templates are organization-wide recommendations
      if (selectedTemplateIds.length > 0) {
        console.log("Recommended templates for job:", selectedTemplateIds);
      }

      return job;
    },
    onSuccess: (job) => {
      const stagesCreated = pipelineStages.length === 0 || (!useDefaultPipeline && customStages.length > 0);
      toast({
        title: "Job posted successfully!",
        description: `${job.title} has been created${stagesCreated ? " with pipeline stages" : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/stages"] });
      if (onSuccess) {
        onSuccess();
      } else {
        setLocation(`/jobs/${job.id}/applications`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to post job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get error for a specific field
  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    setErrors([]);
    const newErrors: FieldError[] = [];

    try {
      if (step === 1) {
        step1Schema.parse({
          title: formData.title,
          location: formData.location,
          type: formData.type,
          deadline: formData.deadline || undefined,
        });
      } else if (step === 2) {
        step2Schema.parse({
          description: formData.description,
          skills,
        });
      } else if (step === 3) {
        step3Schema.parse({
          hiringManagerId: hiringManagerId ? Number(hiringManagerId) : undefined,
          clientId: clientId ? Number(clientId) : undefined,
        });
      }
      // Step 4 has no required validation
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          newErrors.push({
            field: err.path[0] as string,
            message: err.message,
          });
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validateStep(4)) return;

    try {
      const jobData = {
        ...formData,
        skills,
        deadline: formData.deadline || undefined,
        hiringManagerId: hiringManagerId ? Number(hiringManagerId) : undefined,
        clientId: clientId ? Number(clientId) : undefined,
      };

      insertJobSchema.parse(jobData);
      jobMutation.mutate(jobData as any);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation error",
          description: error.errors[0]?.message || "Please check your input",
          variant: "destructive",
        });
      }
    }
  };

  // Handle skill add
  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  // Handle template selection toggle
  const toggleTemplate = (templateId: number) => {
    setSelectedTemplateIds(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  // Render field with inline error
  const renderFieldError = (field: string) => {
    const error = getFieldError(field);
    if (!error) return null;
    return (
      <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    );
  };

  // Group templates by type
  const templatesByType = emailTemplates.reduce((acc, tpl) => {
    const type = tpl.templateType || 'custom';
    if (!acc[type]) acc[type] = [];
    acc[type].push(tpl);
    return acc;
  }, {} as Record<string, EmailTemplate[]>);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => {
                  if (step.id < currentStep) {
                    setCurrentStep(step.id);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm",
                  currentStep === step.id
                    ? "bg-primary text-white"
                    : step.id < currentStep
                    ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                    : "bg-slate-100 text-slate-400"
                )}
                disabled={step.id > currentStep}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium",
                    currentStep === step.id
                      ? "bg-white/20"
                      : step.id < currentStep
                      ? "bg-green-200"
                      : "bg-slate-200"
                  )}
                >
                  {step.id < currentStep ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    step.id
                  )}
                </span>
                <span className="hidden md:block font-medium">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight
                  className={cn(
                    "h-4 w-4 mx-1",
                    step.id < currentStep ? "text-green-500" : "text-slate-300"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 text-lg">
            {STEPS[currentStep - 1].title}
          </CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-4">
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
                  placeholder="e.g. Senior Software Engineer"
                  className={cn(getFieldError("title") && "border-red-500")}
                />
                {renderFieldError("title")}
              </div>

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
                    placeholder="e.g. San Francisco, CA"
                    className={cn(getFieldError("location") && "border-red-500")}
                  />
                  {renderFieldError("location")}
                </div>

                <div>
                  <Label htmlFor="type" className="mb-2 block">
                    Job Type *
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
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
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
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
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSkill())}
                  />
                  <Button type="button" onClick={handleAddSkill} size="icon">
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
                          onClick={() => setSkills(skills.filter((s) => s !== skill))}
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

              <div>
                <Label htmlFor="description" className="mb-2 block">
                  Job Description *
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the role, responsibilities, requirements, and what makes this opportunity exciting..."
                  className={cn("min-h-[200px]", getFieldError("description") && "border-red-500")}
                />
                <div className="flex justify-between mt-1">
                  {renderFieldError("description") || (
                    <p className="text-sm text-slate-500">
                      {formData.description.length}/5000 characters
                    </p>
                  )}
                  <p className="text-sm text-slate-500">
                    {formData.description.length < 50
                      ? `${50 - formData.description.length} more needed`
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Team */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hiringManager" className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    Hiring Manager (Optional)
                  </Label>
                  <Select value={hiringManagerId} onValueChange={setHiringManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a hiring manager..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {hiringManagers.map((hm) => (
                        <SelectItem key={hm.id} value={hm.id.toString()}>
                          {hm.firstName && hm.lastName
                            ? `${hm.firstName} ${hm.lastName} (${hm.username})`
                            : hm.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="client" className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-slate-500" />
                    Client (Optional)
                  </Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Internal role / no client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Internal / No client</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                          {client.domain ? ` (${client.domain})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Setup (Templates & Pipeline) */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Clone from existing job */}
              {existingJobs.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Copy className="h-4 w-4 text-slate-500" />
                    Clone Settings From (Optional)
                  </Label>
                  <Select value={cloneFromJobId} onValueChange={setCloneFromJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Start fresh" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Start fresh</SelectItem>
                      {existingJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id.toString()}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    Clone email templates and pipeline configuration from an existing job
                  </p>
                </div>
              )}

              {/* Email Templates */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-slate-500" />
                  Email Templates
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        Templates are organization-wide and can be used across all jobs.
                        Select the ones you plan to use for this position.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="space-y-3">
                  {Object.entries(templatesByType).map(([type, templates]) => (
                    <div key={type} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">
                        {type.replace(/_/g, ' ')}
                      </p>
                      <div className="space-y-2">
                        {templates.map((tpl) => (
                          <div
                            key={tpl.id}
                            className="flex items-center gap-3 bg-white rounded p-2 border border-slate-200"
                          >
                            <Checkbox
                              checked={selectedTemplateIds.includes(tpl.id)}
                              onCheckedChange={() => toggleTemplate(tpl.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {tpl.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {tpl.subject}
                              </p>
                            </div>
                            {tpl.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {emailTemplates.length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      No email templates available. You can create them later in Settings.
                    </p>
                  )}
                </div>
              </div>

              {/* Pipeline Stages */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-4 w-4 text-slate-500" />
                  Pipeline Stages
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={useDefaultPipeline}
                      onCheckedChange={(checked) => setUseDefaultPipeline(!!checked)}
                    />
                    <span className="text-sm text-slate-700">
                      {pipelineStages.length > 0
                        ? `Use existing pipeline stages (${pipelineStages.length} stages)`
                        : "Use default pipeline stages"}
                    </span>
                  </div>

                  {useDefaultPipeline && pipelineStages.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-7">
                      {pipelineStages.sort((a, b) => a.order - b.order).map((stage) => (
                        <Badge
                          key={stage.id}
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: stage.color || '#6b7280' }}
                        >
                          <div
                            className="w-2 h-2 rounded-full mr-1.5"
                            style={{ backgroundColor: stage.color || '#6b7280' }}
                          />
                          {stage.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {pipelineStages.length === 0 && useDefaultPipeline && (
                    <div className="ml-7 p-3 bg-amber-50 rounded border border-amber-200">
                      <p className="text-sm text-amber-800">
                        No pipeline stages exist yet. Default stages will be created:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {DEFAULT_STAGES.map((stage) => (
                          <Badge
                            key={stage.name}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: stage.color }}
                          >
                            <div
                              className="w-2 h-2 rounded-full mr-1.5"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom stages UI when default pipeline unchecked */}
                  {!useDefaultPipeline && (
                    <div className="ml-7 space-y-3">
                      <p className="text-sm text-slate-600">
                        {pipelineStages.length > 0
                          ? "Add custom stages to extend your existing pipeline:"
                          : "Define your custom pipeline stages:"}
                      </p>

                      {/* Existing custom stages list */}
                      {customStages.length > 0 && (
                        <div className="space-y-2">
                          {customStages.map((stage, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 bg-white rounded p-2 border border-slate-200"
                            >
                              <div
                                className="w-4 h-4 rounded-full border-2"
                                style={{ backgroundColor: stage.color, borderColor: stage.color }}
                              />
                              <span className="flex-1 text-sm font-medium text-slate-700">
                                {stage.name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setCustomStages(prev => prev.filter((_, i) => i !== index))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new stage input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value="#3b82f6"
                          onChange={(e) => {
                            const colorInput = e.target;
                            colorInput.dataset.color = e.target.value;
                          }}
                          className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                          id="newStageColor"
                        />
                        <Input
                          type="text"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                          placeholder="Stage name (e.g., Technical Interview)"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (newStageName.trim()) {
                                const colorInput = document.getElementById("newStageColor") as HTMLInputElement;
                                const color = colorInput?.dataset.color || colorInput?.value || "#3b82f6";
                                setCustomStages(prev => [...prev, { name: newStageName.trim(), color }]);
                                setNewStageName("");
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => {
                            if (newStageName.trim()) {
                              const colorInput = document.getElementById("newStageColor") as HTMLInputElement;
                              const color = colorInput?.dataset.color || colorInput?.value || "#3b82f6";
                              setCustomStages(prev => [...prev, { name: newStageName.trim(), color }]);
                              setNewStageName("");
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {customStages.length === 0 && pipelineStages.length === 0 && (
                        <p className="text-xs text-amber-600">
                          Add at least one stage or switch back to use default pipeline.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Review Summary */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="font-medium text-slate-900 mb-3">Review Your Job Posting</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Title:</span>
                    <span className="text-slate-900 font-medium">{formData.title || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Location:</span>
                    <span className="text-slate-900">{formData.location || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="text-slate-900 capitalize">{formData.type}</span>
                  </div>
                  {skills.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500">Skills:</span>
                      <span className="text-slate-900">{skills.length} added</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Templates:</span>
                    <span className="text-slate-900">{selectedTemplateIds.length} selected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={currentStep === 1 ? () => setLocation("/my-jobs") : handlePrevious}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {currentStep === 1 ? "Cancel" : "Previous"}
            </Button>

            {currentStep < 4 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={jobMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {jobMutation.isPending ? "Posting..." : "Post Job"}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
