import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { EmailTemplate } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Mail, Plus, Loader2 } from "lucide-react";

export default function AdminEmailTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin";
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [name, setName] = useState("");
  const [templateType, setTemplateType] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Redirect if not admin or recruiter
  if (user && !["super_admin", "recruiter"].includes(user.role)) {
    return <Redirect to="/jobs" />;
  }

  // Fetch email templates
  const {
    data: templates = [],
    isLoading,
  } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email-templates", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch email templates");
      }
      return res.json();
    },
    enabled: !!user && ["super_admin", "recruiter"].includes(user.role),
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        subject,
        body,
        templateType: templateType || "custom",
        isDefault: false,
      };
      const res = await apiRequest("POST", "/api/email-templates", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Created",
        description: "Email template has been created successfully.",
      });
      setShowCreateDialog(false);
      setName("");
      setTemplateType("");
      setSubject("");
      setBody("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Template",
        description: error.message || "An error occurred while creating the template.",
        variant: "destructive",
      });
    },
  });

  const toggleDefaultMutation = useMutation({
    mutationFn: async ({ id, isDefault }: { id: number; isDefault: boolean }) => {
      const res = await apiRequest("PATCH", `/api/email-templates/${id}`, { isDefault });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template Updated",
        description: "Default status updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update Template",
        description: error.message || "Only admins can approve templates.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!name || !subject || !body) {
      toast({
        title: "Missing fields",
        description: "Name, subject, and body are required.",
        variant: "destructive",
      });
      return;
    }
    createTemplateMutation.mutate();
  };

  const templateTypeLabel = (type: string) => {
    switch (type) {
      case "application_received":
        return "Application Received";
      case "interview_invite":
        return "Interview Invitation";
      case "status_update":
        return "Status Update";
      case "offer_extended":
        return "Offer Extended";
      case "rejection":
        return "Rejection";
      default:
        return "Custom";
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-7 h-7 text-primary" />
              Email Templates
            </h1>
            <p className="text-slate-500 mt-1">
              View and create reusable email templates for candidates.
            </p>
          </div>
          {(user && ["super_admin", "recruiter"].includes(user.role)) && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>

        {/* Templates Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Templates</CardTitle>
            <CardDescription className="text-slate-500">
              {user?.role === "super_admin"
                ? "All email templates (system defaults and custom templates)"
                : "Email templates available for your ATS workflows"}
            </CardDescription>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2 pt-3">
              {[
                { value: "all", label: "All" },
                { value: "application_received", label: "App Received" },
                { value: "interview_invite", label: "Interview" },
                { value: "status_update", label: "Status Update" },
                { value: "offer_extended", label: "Offer" },
                { value: "rejection", label: "Rejection" },
                { value: "custom", label: "Custom" },
              ].map(({ value, label }) => (
                <Badge
                  key={value}
                  variant={typeFilter === value ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setTypeFilter(value)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">No email templates yet</p>
                <p className="text-slate-500 text-sm">
                  Create your first template to standardize candidate communication.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-slate-50">
                    <TableHead className="text-slate-600">Name</TableHead>
                    <TableHead className="text-slate-600">Type</TableHead>
                    <TableHead className="text-slate-600">Default</TableHead>
                    <TableHead className="text-slate-600">Subject</TableHead>
                    <TableHead className="text-slate-600">Created By</TableHead>
                    <TableHead className="text-slate-600">Created</TableHead>
                    <TableHead className="text-slate-600 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates
                    .filter((t) => typeFilter === "all" || t.templateType === typeFilter)
                    .sort((a, b) => {
                      // Sort defaults to top
                      if (a.isDefault && !b.isDefault) return -1;
                      if (!a.isDefault && b.isDefault) return 1;
                      return a.name.localeCompare(b.name);
                    })
                    .map((tpl) => (
                    <TableRow
                      key={tpl.id}
                      data-template-id={tpl.id}
                      className={`border-slate-200 hover:bg-slate-50 ${tpl.isDefault ? 'bg-green-50/30' : ''}`}
                    >
                      <TableCell className="text-slate-900 font-medium">
                        {tpl.name}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                          {templateTypeLabel(tpl.templateType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tpl.isDefault ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200">
                            Default
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                            Custom
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {tpl.subject.length > 60
                          ? `${tpl.subject.slice(0, 60)}...`
                          : tpl.subject}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {tpl.createdBy === user?.id ? "You" : tpl.createdBy ? `ID: ${tpl.createdBy}` : "System"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {tpl.createdAt
                          ? new Date(tpl.createdAt as unknown as string).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            onClick={() =>
                              toggleDefaultMutation.mutate({
                                id: tpl.id,
                                isDefault: !tpl.isDefault,
                              })
                            }
                            disabled={toggleDefaultMutation.isPending}
                            title={tpl.isDefault ? "Unset as default" : "Mark as default"}
                          >
                            {toggleDefaultMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : tpl.isDefault ? (
                              "Unset Default"
                            ) : (
                              "Mark Default"
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Template Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
              <DialogDescription>
                Define a reusable template for candidate communication. You can insert variables like
                <span className="font-mono">{"{{candidate_name}}"}</span> and{" "}
                <span className="font-mono">{"{{job_title}}"}</span> in the subject and body.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm text-slate-900">Template Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Interview Reminder"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-900">Template Type</Label>
                <Select
                  value={templateType}
                  onValueChange={setTemplateType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application_received">Application Received</SelectItem>
                    <SelectItem value="interview_invite">Interview Invitation</SelectItem>
                    <SelectItem value="status_update">Status Update</SelectItem>
                    <SelectItem value="offer_extended">Offer Extended</SelectItem>
                    <SelectItem value="rejection">Rejection</SelectItem>
                    <SelectItem value="custom">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-900">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Interview Invitation - {{job_title}} at VantaHire"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-900">Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder={`Dear {{candidate_name}},\n\nThank you for applying for the {{job_title}} position...\n`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={createTemplateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createTemplateMutation.isPending}
              >
                {createTemplateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Template"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
