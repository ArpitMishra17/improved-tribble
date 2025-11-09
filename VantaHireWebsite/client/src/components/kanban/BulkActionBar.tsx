import { useState } from "react";
import { X, Mail, FileText, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PipelineStage, EmailTemplate } from "@shared/schema";
import { FormTemplateDTO } from "@/lib/formsApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface BulkActionBarProps {
  selectedCount: number;
  pipelineStages: PipelineStage[];
  emailTemplates: EmailTemplate[];
  formTemplates: FormTemplateDTO[];
  onMoveStage: (stageId: number) => Promise<void>;
  onSendEmails: (templateId: number) => Promise<void>;
  onSendForms: (formId: number, message: string) => Promise<void>;
  onClearSelection: () => void;
  isBulkProcessing: boolean;
  bulkProgress?: { sent: number; total: number };
}

export function BulkActionBar({
  selectedCount,
  pipelineStages,
  emailTemplates,
  formTemplates,
  onMoveStage,
  onSendEmails,
  onSendForms,
  onClearSelection,
  isBulkProcessing,
  bulkProgress,
}: BulkActionBarProps) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showFormsDialog, setShowFormsDialog] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [formMessage, setFormMessage] = useState("");

  if (selectedCount === 0) return null;

  const handleMoveStage = async () => {
    if (!selectedStageId) return;
    await onMoveStage(parseInt(selectedStageId));
    setShowMoveDialog(false);
    setSelectedStageId("");
  };

  const handleSendEmails = async () => {
    if (!selectedTemplateId) return;
    await onSendEmails(parseInt(selectedTemplateId));
    setShowEmailDialog(false);
    setSelectedTemplateId("");
  };

  const handleSendForms = async () => {
    if (!selectedFormId) return;
    await onSendForms(parseInt(selectedFormId), formMessage);
    setShowFormsDialog(false);
    setSelectedFormId("");
    setFormMessage("");
  };

  const progressPercentage = bulkProgress
    ? (bulkProgress.sent / bulkProgress.total) * 100
    : 0;

  return (
    <>
      <div className="sticky top-0 z-50 bg-purple-900/95 backdrop-blur-sm border-b border-white/20 p-4" role="status" aria-live="polite" aria-atomic="true">
        <div className="container mx-auto flex items-center gap-4">
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            {selectedCount} selected
          </Badge>

          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMoveDialog(true)}
              disabled={isBulkProcessing}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <MoveRight className="h-4 w-4 mr-2" />
              Move Stage
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmailDialog(true)}
              disabled={isBulkProcessing || emailTemplates.length === 0}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFormsDialog(true)}
              disabled={isBulkProcessing || formTemplates.length === 0}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <FileText className="h-4 w-4 mr-2" />
              Invite to Form
            </Button>
          </div>

          {isBulkProcessing && bulkProgress && (
            <div className="flex items-center gap-2 min-w-[200px]" role="status" aria-live="polite" aria-atomic="true">
              <Progress value={progressPercentage} className="h-2" />
              <span className="text-sm text-white whitespace-nowrap">
                {bulkProgress.sent}/{bulkProgress.total}
              </span>
              <span className="sr-only">
                Processing {bulkProgress.sent} of {bulkProgress.total} applications
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isBulkProcessing}
            className="text-white hover:bg-white/10"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Move Stage Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-sm border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Move {selectedCount} Applications</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select a stage to move the selected applications to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
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
            <Button
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveStage}
              disabled={!selectedStageId}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              Move Applications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-sm border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Send Email to {selectedCount} Candidates</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select an email template to send to the selected applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendEmails}
              disabled={!selectedTemplateId}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              Send Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Forms Dialog */}
      <Dialog open={showFormsDialog} onOpenChange={setShowFormsDialog}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-sm border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Invite {selectedCount} Candidates to Form</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select a form template to send invitations to the selected applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedFormId} onValueChange={setSelectedFormId}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
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
              <label className="text-sm text-gray-400">Custom message (optional)</label>
              <textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Add a personalized message..."
                className="w-full min-h-[80px] bg-white/5 border border-white/20 rounded-md p-2 text-white placeholder:text-gray-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFormsDialog(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendForms}
              disabled={!selectedFormId}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              Send Invitations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
