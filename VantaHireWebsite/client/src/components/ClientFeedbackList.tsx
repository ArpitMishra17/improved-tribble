import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle, AlertCircle, XCircle, Star } from "lucide-react";

interface ClientFeedback {
  id: number;
  applicationId: number;
  clientId: number;
  shortlistId: number | null;
  recommendation: "advance" | "reject" | "hold";
  notes: string | null;
  rating: number | null;
  createdAt: string | Date;
  client?: {
    id: number;
    name: string;
  } | null;
}

interface ClientFeedbackListProps {
  applicationId: number;
}

const getRecommendationBadge = (rec: ClientFeedback["recommendation"]) => {
  switch (rec) {
    case "advance":
      return (
        <Badge className="bg-success/10 text-success-foreground border-success/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Advance
        </Badge>
      );
    case "hold":
      return (
        <Badge className="bg-warning/10 text-warning-foreground border-warning/30">
          <AlertCircle className="h-3 w-3 mr-1" />
          Hold
        </Badge>
      );
    case "reject":
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-3 w-3 mr-1" />
          Reject
        </Badge>
      );
  }
};

export function ClientFeedbackList({ applicationId }: ClientFeedbackListProps) {
  const { data: feedback = [], isLoading } = useQuery<ClientFeedback[]>({
    queryKey: ["/api/applications", applicationId, "client-feedback"],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/client-feedback`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch client feedback");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-white border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Client Feedback
          </CardTitle>
          <CardDescription>Loading client feedback...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!feedback || feedback.length === 0) {
    return (
      <Card className="bg-white border-border">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Client Feedback
          </CardTitle>
          <CardDescription>No client feedback submitted yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-border">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Client Feedback ({feedback.length})
        </CardTitle>
        <CardDescription>
          Decisions recorded from client review shortlists.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {feedback.map((fb) => (
          <div
            key={fb.id}
            className="border border-border rounded-md p-3 space-y-2 bg-muted/50"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span>{fb.client?.name || "Client"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {getRecommendationBadge(fb.recommendation)}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(fb.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {fb.rating != null && (
              <div className="flex items-center gap-1 text-xs text-foreground">
                <Star className="h-3 w-3 text-warning" />
                <span>{fb.rating}/5</span>
              </div>
            )}
            {fb.notes && (
              <p className="text-xs text-foreground leading-relaxed border-t border-border pt-2">
                {fb.notes}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

