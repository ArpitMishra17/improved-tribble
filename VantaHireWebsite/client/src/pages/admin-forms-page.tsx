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
import { Redirect, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formsApi, formsQueryKeys, type FormTemplateDTO } from "@/lib/formsApi";
import { queryClient } from "@/lib/queryClient";

export default function AdminFormsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
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
    navigate("/admin/forms/editor/new");
  };

  const handleEdit = (template: FormTemplateDTO) => {
    navigate(`/admin/forms/editor/${template.id}`);
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
        <div className="flex items-center justify-between pt-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              Form Templates
            </h1>
            <p className="text-slate-500 mt-1">
              Create and manage custom forms to send to candidates
            </p>
          </div>
          <Button
            onClick={handleCreateNew}
            className=""
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Templates Table */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Templates</CardTitle>
            <CardDescription className="text-slate-500">
              {user?.role === 'admin'
                ? 'All form templates (published and drafts)'
                : 'Published templates and your own drafts'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">No templates yet</p>
                <p className="text-slate-500 text-sm">
                  Create your first template to get started
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-slate-50">
                    <TableHead className="text-slate-600">Template Name</TableHead>
                    <TableHead className="text-slate-600">Status</TableHead>
                    <TableHead className="text-slate-600">Fields</TableHead>
                    <TableHead className="text-slate-600">Created By</TableHead>
                    <TableHead className="text-slate-600">Updated</TableHead>
                    <TableHead className="text-slate-600 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow
                      key={template.id}
                      className="border-slate-200 hover:bg-slate-50"
                    >
                      <TableCell>
                        <div>
                          <p className="text-slate-900 font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-slate-500 text-sm mt-1">
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
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-yellow-50 text-yellow-700 border-yellow-200"
                          }
                        >
                          {template.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {template.fields.length} fields
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {template.createdBy === user?.id ? "You" : `ID: ${template.createdBy}`}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
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
                              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{templateToDelete?.name}"? This action cannot
                be undone.
                {templateToDelete && (
                  <p className="mt-2 text-sm text-amber-600">
                    Note: Templates with existing invitations cannot be deleted.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white text-slate-700 border-slate-300 hover:bg-slate-100">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => templateToDelete && deleteMutation.mutate(templateToDelete.id)}
                className="bg-red-600 hover:bg-red-700"
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
