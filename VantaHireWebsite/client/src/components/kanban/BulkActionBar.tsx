import { useState } from "react";
import { X, Mail, FileText, MoveRight, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PipelineStage, EmailTemplate } from "@shared/schema";
import type { FormTemplateDTO } from "@/lib/formsApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  pipelineStages: PipelineStage[];
  emailTemplates: EmailTemplate[];
  formTemplates: FormTemplateDTO[];
  onMoveStage: (stageId: number) => Promise<void>;
  onSendEmails: (templateId: number) => Promise<void>;
  onSendForms: (formId: number, message: string) => Promise<void>;
  onSelectAll: (selected: boolean) => void;
  onClearSelection: () => void;
  onArchiveSelected: () => Promise<void>;
  isBulkProcessing: boolean;
  bulkProgress?: { sent: number; total: number };
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  pipelineStages,
  emailTemplates,
  formTemplates,
  onMoveStage,
  onSendEmails,
  onSendForms,
  onSelectAll,
  onClearSelection,
  onArchiveSelected,
  isBulkProcessing,
  bulkProgress,
}: BulkActionBarProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showFormsDialog, setShowFormsDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [formMessage, setFormMessage] = useState("");

  // Helper to format template type labels
  const templateTypeLabel = (type: string) => {
    switch (type) {
      case "application_received": return "App Received";
      case "interview_invite": return "Interview";
      case "status_update": return "Status Update";
      case "offer_extended": return "Offer";
      case "rejection": return "Rejection";
      default: return "Custom";
    }
  };

  const hasSelection = selectedCount > 0;
  const allSelected = hasSelection && selectedCount === totalCount;
  const someSelected = hasSelection && selectedCount < totalCount;

  const handleMoveStage = async () => {
    if (!selectedStageId) return;
    await onMoveStage(parseInt(selectedStageId, 10));
    setShowMoveDialog(false);
    setSelectedStageId("");
  };

  const handleSendEmails = async () => {
    if (!selectedTemplateId) return;
    await onSendEmails(parseInt(selectedTemplateId, 10));
    setShowEmailDialog(false);
    setSelectedTemplateId("");
  };

  const handleSendForms = async () => {
    if (!selectedFormId) return;
    await onSendForms(parseInt(selectedFormId, 10), formMessage);
    setShowFormsDialog(false);
    setSelectedFormId("");
    setFormMessage("");
  };

  const progressPercentage =
    bulkProgress && bulkProgress.total > 0
      ? (bulkProgress.sent / bulkProgress.total) * 100
      : 0;

  return (
    <>
      <div
        className="sticky top-0 z-20 bg-white border-b border-slate-200 p-3 shadow-sm"
        role="toolbar"
        aria-label="Bulk actions"
      >
        <div className="container mx-auto flex items-center gap-4">
          {/* Select All Checkbox */}
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={someSelected ? "indeterminate" : allSelected}
              onCheckedChange={(checked) => onSelectAll(!!checked)}
              aria-label="Select all applications"
              disabled={isBulkProcessing || totalCount === 0}
            />
            <span className={cn(
              "text-sm",
              hasSelection ? "text-slate-900 font-medium" : "text-slate-500"
            )}>
              {hasSelection ? `${selectedCount} selected` : "Select all"}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-1">
            <Button
              size="sm"
              variant={hasSelection ? "default" : "ghost"}
              onClick={() => setShowMoveDialog(true)}
              disabled={isBulkProcessing || !hasSelection}
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Move Stage
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEmailDialog(true)}
              disabled={isBulkProcessing || !hasSelection || emailTemplates.length === 0}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFormsDialog(true)}
              disabled={isBulkProcessing || !hasSelection || formTemplates.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              Form
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowArchiveDialog(true)}
              disabled={isBulkProcessing || !hasSelection}
              className="text-slate-600 hover:text-red-600 hover:bg-red-50"
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          </div>

          {/* Progress indicator */}
          {isBulkProcessing && bulkProgress && bulkProgress.total > 0 && (
            <div
              className="flex items-center gap-2 min-w-[180px]"
              role="status"
              aria-live="polite"
            >
              <Progress value={progressPercentage} className="h-2" />
              <span className="text-sm text-slate-600 whitespace-nowrap">
                {bulkProgress.sent}/{bulkProgress.total}
              </span>
            </div>
          )}

          {/* Clear Selection */}
          {hasSelection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isBulkProcessing}
              className="text-slate-500 hover:text-slate-700"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Move Stage Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Move Selected Applications</DialogTitle>
            <DialogDescription>
              Choose a new stage for the selected applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveStage} disabled={!selectedStageId}>
              Move Applications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Email to {selectedCount} Candidates</DialogTitle>
            <DialogDescription>
              Select an email template to send to the selected applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates
                  .sort((a, b) => {
                    // Sort defaults first
                    if (a.isDefault && !b.isDefault) return -1;
                    if (!a.isDefault && b.isDefault) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        <span className="text-xs text-slate-500">
                          ({templateTypeLabel(template.templateType)})
                        </span>
                        {template.isDefault && (
                          <span className="text-xs font-medium text-green-600">(Default)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Template Preview */}
            {selectedTemplateId && (() => {
              const template = emailTemplates.find(t => t.id === parseInt(selectedTemplateId));
              if (!template) return null;
              const firstLine = template.body.split('\n')[0];
              return (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                  <p className="text-xs font-medium text-slate-700">Preview:</p>
                  <p className="text-sm text-slate-900 font-medium">{template.subject}</p>
                  <p className="text-xs text-slate-600 truncate">{firstLine || template.body.substring(0, 80)}...</p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmails}
              disabled={!selectedTemplateId}
            >
              Send Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Forms Dialog */}
      <Dialog open={showFormsDialog} onOpenChange={setShowFormsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite {selectedCount} Candidates to Form</DialogTitle>
            <DialogDescription>
              Select a form template to send invitations to the selected
              applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger>
                <SelectValue placeholder="Select form" />
              </SelectTrigger>
              <SelectContent>
                {formTemplates.map((form) => (
                  <SelectItem key={form.id} value={form.id.toString()}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <label className="text-sm text-slate-600">
                Custom message (optional)
              </label>
              <textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Add a personalized message..."
                className="w-full min-h-[80px] rounded-md border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFormsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendForms}
              disabled={!selectedFormId}
            >
              Send Invitations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedCount} Applications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the selected applications. They will be hidden from the
              active pipeline but can be restored later from the archive view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onArchiveSelected();
                setShowArchiveDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

