import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, ExternalLink, FileText, AlertCircle, CheckCircle, XCircle, Sparkles, Brain } from "lucide-react";

interface ResumePreviewModalProps {
  applicationId: number | null;
  applicationName: string;
  applicationEmail: string;
  jobTitle?: string | undefined;
  resumeUrl: string | null;
  status?: string | undefined;
  aiFitScore?: number | null | undefined;
  aiFitLabel?: string | null | undefined;
  aiFitReasons?: string[] | null | undefined;
  resumeText?: string | null;
  open: boolean;
  onClose: () => void;
  onDownload?: () => void;
  onMoveToScreening?: (notes: string) => void;
  onReject?: (notes: string) => void;
}

export function ResumePreviewModal({
  applicationId,
  applicationName,
  applicationEmail,
  jobTitle,
  resumeUrl,
  status,
  aiFitScore,
  aiFitLabel,
  aiFitReasons,
  resumeText,
  open,
  onClose,
  onDownload,
  onMoveToScreening,
  onReject,
}: ResumePreviewModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!applicationId) return null;

  const fullResumeUrl = resumeUrl
    ? `/api/applications/${applicationId}/resume`
    : null;

  // Check if resume is a PDF
  const isPdf = resumeUrl?.toLowerCase().endsWith('.pdf') ||
    resumeUrl?.toLowerCase().includes('pdf');

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    }
    if (fullResumeUrl) {
      window.open(fullResumeUrl, '_blank');
    }
  };

  const handleMoveToScreening = async () => {
    if (onMoveToScreening) {
      setIsSubmitting(true);
      await onMoveToScreening(notes);
      setIsSubmitting(false);
      setNotes("");
      onClose();
    }
  };

  const handleReject = async () => {
    if (onReject) {
      setIsSubmitting(true);
      await onReject(notes);
      setIsSubmitting(false);
      setNotes("");
      onClose();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'submitted': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'reviewed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'shortlisted': return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getFitBadgeColor = (label: string) => {
    const colorMap: Record<string, string> = {
      'Exceptional': 'bg-green-50 text-green-700 border-green-200',
      'Strong': 'bg-blue-50 text-blue-700 border-blue-200',
      'Good': 'bg-purple-50 text-purple-700 border-purple-200',
      'Partial': 'bg-amber-50 text-amber-700 border-amber-200',
      'Low': 'bg-red-50 text-red-700 border-red-200',
    };
    return colorMap[label] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-semibold text-slate-900">
                  {applicationName}
                </DialogTitle>
                {status && (
                  <Badge className={getStatusColor(status)}>
                    {status}
                  </Badge>
                )}
                {aiFitLabel && aiFitScore !== null && aiFitScore !== undefined && (
                  <Badge variant="outline" className={`${getFitBadgeColor(aiFitLabel)} font-medium`}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    {aiFitLabel} ({aiFitScore})
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">{applicationEmail}</p>
              {jobTitle && (
                <p className="text-sm text-slate-600 mt-0.5">Applied for: {jobTitle}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Main Content - Two Column Layout */}
        <div className="flex-1 flex overflow-hidden" data-testid="resume-review-modal">
          {/* Left: Resume Preview */}
          <div className="flex-1 flex flex-col border-r border-slate-200">
            {/* Resume Actions Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500" />
                <span className="text-sm text-slate-600">
                  {resumeUrl?.split('/').pop() || 'Resume'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {fullResumeUrl && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(fullResumeUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Resume Preview */}
            <div className="flex-1 overflow-hidden p-4" data-testid="resume-preview-pane">
              <div className="h-full border border-slate-200 rounded-lg overflow-hidden bg-slate-50" data-testid="resume-preview-frame">
                {fullResumeUrl ? (
                  isPdf ? (
                    <iframe
                      src={`${fullResumeUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full"
                      title="Resume Preview"
                    />
                  ) : (
                    <object
                      data={fullResumeUrl}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      {/* Fallback for non-PDF files */}
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <FileText className="h-16 w-16 text-slate-300 mb-4" />
                        <p className="text-slate-600 mb-4">
                          Unable to preview this file type in browser.
                        </p>
                        <Button onClick={() => window.open(fullResumeUrl, '_blank')}>
                          <Download className="h-4 w-4 mr-2" />
                          Download to View
                        </Button>
                      </div>
                    </object>
                  )
                ) : resumeText ? (
                  <div className="h-full p-4 overflow-auto bg-white">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Resume text</p>
                    <pre className="whitespace-pre-wrap text-sm text-slate-800 font-sans leading-relaxed">
                      {resumeText}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <AlertCircle className="h-16 w-16 text-slate-300 mb-4" />
                    <p className="text-slate-500">No resume available for this application</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Review Panel */}
          <div className="w-80 flex flex-col bg-slate-50">
            <div className="p-4 flex-1 overflow-auto">
              {/* AI Fit Analysis */}
              {aiFitReasons && Array.isArray(aiFitReasons) && aiFitReasons.length > 0 && (
                <div className="mb-4 p-3 bg-primary/5 rounded-lg border-l-4 border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="text-primary font-medium text-sm">AI Analysis</span>
                  </div>
                  <ul className="text-slate-600 text-sm space-y-1">
                    {aiFitReasons.slice(0, 4).map((reason: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Review Notes */}
              <div className="mb-4">
                <label className="text-slate-900 text-sm font-medium mb-2 block">
                  Review Notes
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this candidate..."
                  className="min-h-[120px] bg-white"
                />
              </div>

              {/* Quick Actions Info */}
              <div className="text-xs text-slate-500 mb-4">
                <p>Choose an action below to update the candidate's status and move them through the pipeline.</p>
              </div>
            </div>

            {/* Action Buttons - Fixed at Bottom */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-2">
              <Button
                className="w-full"
                onClick={handleMoveToScreening}
                disabled={isSubmitting}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Move to Screening
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
