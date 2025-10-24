import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Plus, Edit, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formsApi, formsQueryKeys, type FormTemplateDTO } from "@/lib/formsApi";
import { queryClient } from "@/lib/queryClient";
import { TemplateEditorModal } from "@/components/TemplateEditorModal";

export default function AdminFormsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplateDTO | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<FormTemplateDTO | null>(null);

  // Redirect if not admin or recruiter
  if (user && !['admin', 'recruiter'].includes(user.role)) {
    return <Redirect to="/jobs" />;
  }

  // Fetch templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: formsQueryKeys.templates(),
    queryFn: formsApi.listTemplates,
    enabled: !!user && ['admin', 'recruiter'].includes(user.role),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => formsApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formsQueryKeys.templates() });
      toast({
        title: "Template Deleted",
        description: "Form template has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Template",
        description: error.message || "Cannot delete template with existing invitations.",
        variant: "destructive",
      });
    },
  });

  // Publish/Unpublish mutation
  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      formsApi.updateTemplate(id, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formsQueryKeys.templates() });
      toast({
        title: "Template Updated",
        description: "Template publish status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Template",
        description: error.message || "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: FormTemplateDTO) => {
    setSelectedTemplate(template);
    setEditorOpen(true);
  };

  const handleDelete = (template: FormTemplateDTO) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleTogglePublish = (template: FormTemplateDTO) => {
    togglePublishMutation.mutate({
      id: template.id,
      isPublished: !template.isPublished,
    });
  };

  const canEditTemplate = (template: FormTemplateDTO) => {
    return user?.role === 'admin' || template.createdBy === user?.id;
  };

  const templates = templatesData?.templates || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <FileText className="w-8 h-8 text-purple-400" />
              Form Templates
            </h1>
            <p className="text-slate-400 mt-1">
              Create and manage custom forms to send to candidates
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Templates Table */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Templates</CardTitle>
            <CardDescription className="text-slate-400">
              {user?.role === 'admin'
                ? 'All form templates (published and drafts)'
                : 'Published templates and your own drafts'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">No templates yet</p>
                <p className="text-slate-500 text-sm">
                  Create your first template to get started
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableHead className="text-slate-300">Template Name</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300">Fields</TableHead>
                    <TableHead className="text-slate-300">Created By</TableHead>
                    <TableHead className="text-slate-300">Updated</TableHead>
                    <TableHead className="text-slate-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow
                      key={template.id}
                      className="border-slate-700 hover:bg-slate-800/50"
                    >
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-slate-400 text-sm mt-1">
                              {template.description.length > 60
                                ? `${template.description.slice(0, 60)}...`
                                : template.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            template.isPublished
                              ? "bg-green-500/20 text-green-300 border-0"
                              : "bg-yellow-500/20 text-yellow-300 border-0"
                          }
                        >
                          {template.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {template.fields.length} fields
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {template.createdBy === user?.id ? "You" : `ID: ${template.createdBy}`}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Publish */}
                          {canEditTemplate(template) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePublish(template)}
                              disabled={togglePublishMutation.isPending}
                              className="text-slate-300 hover:text-white hover:bg-slate-700"
                              title={template.isPublished ? "Unpublish" : "Publish"}
                            >
                              {template.isPublished ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {/* Edit */}
                          {canEditTemplate(template) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(template)}
                              className="text-slate-300 hover:text-white hover:bg-slate-700"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Delete */}
                          {canEditTemplate(template) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(template)}
                              disabled={deleteMutation.isPending}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Template Editor Modal */}
        <TemplateEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={selectedTemplate}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-slate-900 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete Template?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Are you sure you want to delete "{templateToDelete?.name}"? This action cannot
                be undone.
                {templateToDelete && (
                  <p className="mt-2 text-sm text-amber-400">
                    Note: Templates with existing invitations cannot be deleted.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => templateToDelete && deleteMutation.mutate(templateToDelete.id)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
