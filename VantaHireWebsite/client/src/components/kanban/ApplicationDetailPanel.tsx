import { useState, useEffect } from "react";
import { X, Mail, Phone, Calendar, Clock, MapPin, Download, Star, FileText, History as HistoryIcon, MessageSquare, Target, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Application, EmailTemplate, PipelineStage } from "@shared/schema";
import { FormTemplateDTO } from "@/lib/formsApi";
import { AISummaryPanel } from "@/components/AISummaryPanel";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { ClientFeedbackList } from "@/components/ClientFeedbackList";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApplicationDetailPanelProps {
  application: Application;
  jobId: number;
  pipelineStages: PipelineStage[];
  emailTemplates: EmailTemplate[];
  formTemplates: FormTemplateDTO[];
  stageHistory: any[];
  onClose: () => void;
  onMoveStage: (stageId: number, notes?: string) => void;
  onScheduleInterview: (data: { date: string; time: string; location: string; notes: string }) => void;
  onSendEmail: (templateId: number) => void;
  onSendForm: (formId: number, message: string) => void;
  onAddNote: (note: string) => void;
  onSetRating: (rating: number) => void;
  onDownloadResume: () => void;
  onUpdateStatus?: (status: string, notes?: string) => void;
}

export function ApplicationDetailPanel({
  application,
  jobId,
  pipelineStages,
  emailTemplates,
  formTemplates,
  stageHistory,
  onClose,
  onMoveStage,
  onScheduleInterview,
  onSendEmail,
  onSendForm,
  onAddNote,
  onSetRating,
  onDownloadResume,
  onUpdateStatus,
}: ApplicationDetailPanelProps) {
  const { toast } = useToast();
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [stageNotes, setStageNotes] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [formMessage, setFormMessage] = useState("");
  const [newNote, setNewNote] = useState("");
  const [rating, setRating] = useState<string>(application.rating?.toString() || "");

  // AI Email Draft state
  const [emailTone, setEmailTone] = useState<'friendly' | 'formal'>('friendly');
  const [aiDraftSubject, setAiDraftSubject] = useState<string>("");
  const [aiDraftBody, setAiDraftBody] = useState<string>("");
  const [showAiDraft, setShowAiDraft] = useState(false);

  // Smart default template selection based on context
  useEffect(() => {
    if (!selectedTemplateId && emailTemplates.length > 0) {
      // Check current stage to determine appropriate template
      const currentStage = pipelineStages.find(s => s.id === application.currentStage);
      const stageName = currentStage?.name.toLowerCase() || '';

      // Determine template type based on stage and status
      // Check rejection first (status takes priority)
      let targetType: string | null = null;
      if (application.status === 'rejected' || stageName.includes('reject')) {
        targetType = 'rejection';
      } else if (stageName.includes('interview') || stageName.includes('screening')) {
        targetType = 'interview_invite';
      } else if (stageName.includes('offer')) {
        targetType = 'offer_extended';
      }

      // Find default template of target type
      if (targetType) {
        const defaultTemplate = emailTemplates.find(
          t => t.templateType === targetType && t.isDefault
        );
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id.toString());
        }
      }
    }
  }, [emailTemplates, application.currentStage, application.status, pipelineStages, selectedTemplateId]);

  // AI Email Draft mutation
  const generateEmailDraftMutation = useMutation({
    mutationFn: async ({ templateId, tone }: { templateId: number; tone: 'friendly' | 'formal' }) => {
      const res = await apiRequest("POST", "/api/email/draft", {
        templateId,
        applicationId: application.id,
        tone,
      });
      return await res.json();
    },
    onSuccess: (data: { subject: string; body: string }) => {
      setAiDraftSubject(data.subject);
      setAiDraftBody(data.body);
      setShowAiDraft(true);
      toast({
        title: "AI Draft Generated",
        description: "Email has been personalized with AI. Review before sending.",
      });
    },
    onError: (error: Error) => {
      const is429 = error.message.includes("429");
      toast({
        title: is429 ? "AI limit reached" : "AI draft failed",
        description: is429
          ? "You've reached today's AI email limit. Please try again tomorrow."
          : error.message,
        variant: "destructive",
      });
    },
  });

  const handleMoveStage = () => {
    if (!selectedStageId) return;
    onMoveStage(parseInt(selectedStageId), stageNotes || undefined);
    setSelectedStageId("");
    setStageNotes("");
  };

  const handleScheduleInterview = () => {
    if (!interviewDate || !interviewTime || !interviewLocation) return;
    onScheduleInterview({
      date: interviewDate,
      time: interviewTime,
      location: interviewLocation,
      notes: interviewNotes,
    });
    setInterviewDate("");
    setInterviewTime("");
    setInterviewLocation("");
    setInterviewNotes("");
  };

  const handleGenerateAIDraft = () => {
    if (!selectedTemplateId) {
      toast({
        title: "No template selected",
        description: "Please select an email template first.",
        variant: "destructive",
      });
      return;
    }
    generateEmailDraftMutation.mutate({
      templateId: parseInt(selectedTemplateId),
      tone: emailTone,
    });
  };

  const handleSendEmail = () => {
    if (!selectedTemplateId) return;
    onSendEmail(parseInt(selectedTemplateId));
    setSelectedTemplateId("");
    setShowAiDraft(false);
    setAiDraftSubject("");
    setAiDraftBody("");
  };

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

  const handleSendForm = () => {
    if (!selectedFormId) return;
    onSendForm(parseInt(selectedFormId), formMessage);
    setSelectedFormId("");
    setFormMessage("");
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    onAddNote(newNote);
    setNewNote("");
  };

  const handleSetRating = () => {
    const ratingValue = parseInt(rating);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) return;
    onSetRating(ratingValue);
  };

  const currentStage = pipelineStages.find((s) => s.id === application.currentStage);

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h2 className="text-slate-900 text-lg font-semibold">Application Details</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-slate-600 hover:bg-slate-100"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="flex w-full overflow-x-auto gap-2 whitespace-nowrap">
            <TabsTrigger className="min-w-[88px]" value="summary">Summary</TabsTrigger>
            <TabsTrigger className="min-w-[64px]" value="ai">AI</TabsTrigger>
            <TabsTrigger className="min-w-[96px]" value="feedback">Feedback</TabsTrigger>
            <TabsTrigger className="min-w-[88px]" value="history">History</TabsTrigger>
            <TabsTrigger className="min-w-[72px]" value="notes">Notes</TabsTrigger>
            <TabsTrigger className="min-w-[104px]" value="interview">Interview</TabsTrigger>
            <TabsTrigger className="min-w-[80px]" value="rating">Rating</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 text-lg">{application.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="text-sm">{application.email}</span>
                  </div>
                  {application.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="text-sm">{application.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      Applied {new Date(application.appliedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
                    {application.status}
                  </Badge>
                  {currentStage && (
                    <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">
                      {currentStage.name}
                    </Badge>
                  )}
                  {application.interviewDate && (
                    <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                      Interview Scheduled
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={onDownloadResume}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Resume
                </Button>

                {/* Move Stage */}
                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <Label className="text-slate-900">Move to Stage</Label>
                  <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                    <SelectTrigger className="bg-white border-slate-300">
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
                  <Textarea
                    placeholder="Add notes (optional)"
                    value={stageNotes}
                    onChange={(e) => setStageNotes(e.target.value)}
                    className="bg-white border-slate-300 placeholder:text-slate-500"
                  />
                  <Button
                    onClick={handleMoveStage}
                    disabled={!selectedStageId}
                    className="w-full"
                  >
                    Move Stage
                  </Button>
                </div>

                {/* Send Email */}
                {emailTemplates.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <Label className="text-slate-900">Send Email</Label>

                    {/* Template Selector */}
                    <Select value={selectedTemplateId} onValueChange={(value) => {
                      setSelectedTemplateId(value);
                      setShowAiDraft(false);
                    }}>
                      <SelectTrigger className="bg-white border-slate-300">
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

                    {/* Tone Selector */}
                    {selectedTemplateId && (
                      <div className="space-y-2">
                        <Label className="text-slate-900 text-sm">Tone</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={emailTone === 'friendly' ? 'default' : 'outline'}
                            onClick={() => setEmailTone('friendly')}
                            className="flex-1"
                          >
                            Friendly
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={emailTone === 'formal' ? 'default' : 'outline'}
                            onClick={() => setEmailTone('formal')}
                            className="flex-1"
                          >
                            Formal
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Generate with AI Button */}
                    {selectedTemplateId && (
                      <Button
                        onClick={handleGenerateAIDraft}
                        disabled={generateEmailDraftMutation.isPending}
                        variant="outline"
                        className="w-full border-primary/30 text-primary hover:bg-primary/10"
                      >
                        {generateEmailDraftMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate with AI
                          </>
                        )}
                      </Button>
                    )}

                    {/* AI Draft Preview */}
                    {showAiDraft && aiDraftSubject && aiDraftBody && (
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-primary font-medium text-sm">AI-Generated Preview</Label>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs text-slate-600">Subject:</Label>
                            <p className="text-sm text-slate-900 font-medium">{aiDraftSubject}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-600">Body:</Label>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {aiDraftBody}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Send Email Button */}
                    <Button
                      onClick={handleSendEmail}
                      disabled={!selectedTemplateId}
                      variant="outline"
                      className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                  </div>
                )}

                {/* Send Form */}
                {formTemplates.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-slate-200">
                    <Label className="text-slate-900">Invite to Form</Label>
                    <Select value={selectedFormId} onValueChange={setSelectedFormId}>
                      <SelectTrigger className="bg-white border-slate-300">
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
                    <Textarea
                      placeholder="Custom message (optional)"
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      className="bg-white border-slate-300 placeholder:text-slate-500"
                    />
                    <Button
                      onClick={handleSendForm}
                      disabled={!selectedFormId}
                      variant="outline"
                      className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Send Invitation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Summary Tab */}
          <TabsContent value="ai" className="space-y-4">
            <AISummaryPanel
              applicationId={application.id}
              jobId={jobId}
              aiSummary={application.aiSummary}
              aiSuggestedAction={application.aiSuggestedAction}
              aiSuggestedActionReason={application.aiSuggestedActionReason}
              aiSummaryComputedAt={application.aiSummaryComputedAt}
              pipelineStages={pipelineStages}
              currentStageId={application.currentStage}
              onMoveStage={onMoveStage}
              onAddNote={onAddNote}
              onUpdateStatus={onUpdateStatus}
            />
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <FeedbackPanel applicationId={application.id} jobId={jobId} canAdd={true} />
            <ClientFeedbackList applicationId={application.id} />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-3">
            {stageHistory.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No history available</p>
            ) : (
              stageHistory.map((entry: any, index: number) => (
                <Card key={index} className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <HistoryIcon className="h-4 w-4 text-primary mt-1" />
                      <div className="flex-1">
                        <p className="text-slate-900 text-sm font-medium">{entry.action}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                        {entry.notes && (
                          <p className="text-slate-600 text-sm mt-2">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-3">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="bg-white border-slate-300 placeholder:text-slate-500 min-h-[100px]"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {application.recruiterNotes && application.recruiterNotes.length > 0 ? (
              application.recruiterNotes.map((note: any, index: number) => (
                <Card key={index} className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-slate-600 text-sm">{note.content || note}</p>
                    {note.timestamp && (
                      <p className="text-slate-500 text-xs mt-2">
                        {new Date(note.timestamp).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">No notes yet</p>
            )}
          </TabsContent>

          {/* Interview Tab */}
          <TabsContent value="interview" className="space-y-3">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 text-base">Schedule Interview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-slate-900">Date</Label>
                  <Input
                    type="date"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-900">Time</Label>
                  <Input
                    type="time"
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                    className="bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-900">Location</Label>
                  <Input
                    placeholder="Office, Zoom link, etc."
                    value={interviewLocation}
                    onChange={(e) => setInterviewLocation(e.target.value)}
                    className="bg-white border-slate-300 placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-900">Notes (optional)</Label>
                  <Textarea
                    placeholder="Additional interview details..."
                    value={interviewNotes}
                    onChange={(e) => setInterviewNotes(e.target.value)}
                    className="bg-white border-slate-300 placeholder:text-slate-500"
                  />
                </div>
                <Button
                  onClick={handleScheduleInterview}
                  disabled={!interviewDate || !interviewTime || !interviewLocation}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Interview
                </Button>
              </CardContent>
            </Card>

            {application.interviewDate && (
              <Card className="bg-slate-50 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900 text-base">Current Interview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm">{new Date(application.interviewDate).toLocaleDateString()}</span>
                  </div>
                  {application.interviewTime && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm">{application.interviewTime}</span>
                    </div>
                  )}
                  {application.interviewLocation && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="text-sm">{application.interviewLocation}</span>
                    </div>
                  )}
                  {application.interviewNotes && (
                    <p className="text-slate-600 text-sm mt-3">{application.interviewNotes}</p>
                  )}
                  <div className="pt-3 border-t border-slate-200 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        window.open(`/api/applications/${application.id}/interview/ics`, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Add to Calendar (.ics)
                    </Button>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      Share with interviewers and candidate
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Rating Tab */}
          <TabsContent value="rating" className="space-y-3">
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader>
                <CardTitle className="text-slate-900 text-base">Candidate Rating</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-slate-900">Rating (1-5)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="bg-white border-slate-300"
                  />
                </div>
                <Button
                  onClick={handleSetRating}
                  disabled={!rating || parseInt(rating) < 1 || parseInt(rating) > 5}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Set Rating
                </Button>
                {application.rating !== null && application.rating !== undefined && (
                  <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-200">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-slate-900 text-lg font-semibold">{application.rating}/5</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
