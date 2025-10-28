import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getCsrfToken } from "@/lib/csrf";
import type { PipelineStage } from "@shared/schema";
import { Plus } from "lucide-react";

interface AddCandidateModalProps {
  jobId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCandidateModal({
  jobId,
  open,
  onOpenChange,
}: AddCandidateModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [source, setSource] = useState("recruiter_add");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [initialStageId, setInitialStageId] = useState("");

  // Fetch pipeline stages
  const { data: pipelineStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
    queryFn: async () => {
      const response = await fetch("/api/pipeline/stages");
      if (!response.ok) throw new Error("Failed to fetch pipeline stages");
      return response.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/jobs/${jobId}/applications/recruiter-add`, {
        method: "POST",
        headers: {
          "x-csrf-token": csrf,
        },
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || "Failed to add candidate");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "applications"],
      });
      toast({
        title: "Candidate Added",
        description: "Application created successfully.",
      });
      onOpenChange(false);
      // Reset form
      setName("");
      setEmail("");
      setPhone("");
      setCoverLetter("");
      setSource("recruiter_add");
      setResumeFile(null);
      setInitialStageId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Candidate",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!name || !email || !phone || !resumeFile) {
      toast({
        title: "Validation Error",
        description: "Name, email, phone, and resume are required",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("coverLetter", coverLetter);
    formData.append("source", source);
    if (initialStageId) {
      formData.append("currentStage", initialStageId);
    }
    formData.append("resume", resumeFile);

    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>
            Create an application on behalf of a candidate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-white">Name *</label>
            <Input
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">Email *</label>
            <Input
              type="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">Phone *</label>
            <Input
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">
              Cover Letter / Notes
            </label>
            <Textarea
              placeholder="Strong Python skills, met at tech conference..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={4}
              className="mt-1 bg-white/5 border-white/20 text-white placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white">Source</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recruiter_add">Added by Recruiter</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="indeed">Indeed</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-white">
              Initial Stage (Optional)
            </label>
            <Select value={initialStageId} onValueChange={setInitialStageId}>
              <SelectTrigger className="mt-1 bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {pipelineStages
                  .sort((a, b) => a.order - b.order)
                  .map((stage) => (
                    <SelectItem key={stage.id} value={stage.id.toString()}>
                      {stage.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-white">Resume *</label>
            <Input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              className="mt-1 bg-white/5 border-white/20 text-white file:text-white"
            />
            {resumeFile && (
              <p className="text-sm text-gray-400 mt-1">
                Selected: {resumeFile.name} ({(resumeFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="bg-gradient-to-r from-[#7B38FB] to-[#FF5BA8] hover:opacity-90"
          >
            {mutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Candidate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
