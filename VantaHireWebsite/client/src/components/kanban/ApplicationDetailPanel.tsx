import { useState } from "react";
import { X, Mail, Phone, Calendar, Clock, MapPin, Download, Star, FileText, History as HistoryIcon, MessageSquare, Target } from "lucide-react";
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

interface ApplicationDetailPanelProps {
  application: Application;
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
}

export function ApplicationDetailPanel({
  application,
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
}: ApplicationDetailPanelProps) {
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

  const handleSendEmail = () => {
    if (!selectedTemplateId) return;
    onSendEmail(parseInt(selectedTemplateId));
    setSelectedTemplateId("");
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
    <div className="h-full flex flex-col bg-slate-900/95 backdrop-blur-sm border-l border-white/20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <h2 className="text-white text-lg font-semibold">Application Details</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white hover:bg-white/10"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/5">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="interview">Interview</TabsTrigger>
            <TabsTrigger value="rating">Rating</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <Card className="bg-white/5 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg">{application.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="h-4 w-4 text-purple-400" />
                    <span className="text-sm">{application.email}</span>
                  </div>
                  {application.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="h-4 w-4 text-purple-400" />
                      <span className="text-sm">{application.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <span className="text-sm">
                      Applied {new Date(application.appliedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-blue-400/50 text-blue-300">
                    {application.status}
                  </Badge>
                  {currentStage && (
                    <Badge variant="outline" className="border-purple-400/50 text-purple-300">
                      {currentStage.name}
                    </Badge>
                  )}
                  {application.interviewDate && (
                    <Badge variant="outline" className="border-green-400/50 text-green-300">
                      Interview Scheduled
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={onDownloadResume}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Resume
                </Button>

                {/* Move Stage */}
                <div className="space-y-2 pt-4 border-t border-white/20">
                  <Label className="text-white">Move to Stage</Label>
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
                  <Textarea
                    placeholder="Add notes (optional)"
                    value={stageNotes}
                    onChange={(e) => setStageNotes(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
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
                  <div className="space-y-2 pt-4 border-t border-white/20">
                    <Label className="text-white">Send Email</Label>
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
                    <Button
                      onClick={handleSendEmail}
                      disabled={!selectedTemplateId}
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                  </div>
                )}

                {/* Send Form */}
                {formTemplates.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-white/20">
                    <Label className="text-white">Invite to Form</Label>
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
                    <Textarea
                      placeholder="Custom message (optional)"
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                    />
                    <Button
                      onClick={handleSendForm}
                      disabled={!selectedFormId}
                      variant="outline"
                      className="w-full border-white/20 text-white hover:bg-white/10"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Send Invitation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-3">
            {stageHistory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No history available</p>
            ) : (
              stageHistory.map((entry: any, index: number) => (
                <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <HistoryIcon className="h-4 w-4 text-purple-400 mt-1" />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{entry.action}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                        {entry.notes && (
                          <p className="text-gray-300 text-sm mt-2">{entry.notes}</p>
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
            <Card className="bg-white/5 backdrop-blur-sm border-white/20">
              <CardContent className="p-4 space-y-3">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 min-h-[100px]"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {application.recruiterNotes && application.recruiterNotes.length > 0 ? (
              application.recruiterNotes.map((note: any, index: number) => (
                <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/20">
                  <CardContent className="p-4">
                    <p className="text-gray-300 text-sm">{note.content || note}</p>
                    {note.timestamp && (
                      <p className="text-gray-400 text-xs mt-2">
                        {new Date(note.timestamp).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No notes yet</p>
            )}
          </TabsContent>

          {/* Interview Tab */}
          <TabsContent value="interview" className="space-y-3">
            <Card className="bg-white/5 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-base">Schedule Interview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white">Date</Label>
                  <Input
                    type="date"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Time</Label>
                  <Input
                    type="time"
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Location</Label>
                  <Input
                    placeholder="Office, Zoom link, etc."
                    value={interviewLocation}
                    onChange={(e) => setInterviewLocation(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Notes (optional)</Label>
                  <Textarea
                    placeholder="Additional interview details..."
                    value={interviewNotes}
                    onChange={(e) => setInterviewNotes(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-400"
                  />
                </div>
                <Button
                  onClick={handleScheduleInterview}
                  disabled={!interviewDate || !interviewTime || !interviewLocation}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Interview
                </Button>
              </CardContent>
            </Card>

            {application.interviewDate && (
              <Card className="bg-white/5 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white text-base">Current Interview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    <span className="text-sm">{new Date(application.interviewDate).toLocaleDateString()}</span>
                  </div>
                  {application.interviewTime && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="h-4 w-4 text-purple-400" />
                      <span className="text-sm">{application.interviewTime}</span>
                    </div>
                  )}
                  {application.interviewLocation && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin className="h-4 w-4 text-purple-400" />
                      <span className="text-sm">{application.interviewLocation}</span>
                    </div>
                  )}
                  {application.interviewNotes && (
                    <p className="text-gray-300 text-sm mt-3">{application.interviewNotes}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Rating Tab */}
          <TabsContent value="rating" className="space-y-3">
            <Card className="bg-white/5 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-base">Candidate Rating</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-white">Rating (1-5)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
                <Button
                  onClick={handleSetRating}
                  disabled={!rating || parseInt(rating) < 1 || parseInt(rating) > 5}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  <Star className="h-4 w-4 mr-2" />
                  Set Rating
                </Button>
                {application.rating !== null && application.rating !== undefined && (
                  <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/20">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-white text-lg font-semibold">{application.rating}/5</span>
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
