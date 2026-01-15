import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProfileStatus } from "@/hooks/use-profile-status";
import { CheckCircle2, Circle, Clock, User, FileText, Building2, Linkedin, MapPin, FileEdit } from "lucide-react";

interface ProfileCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fieldIcons: Record<string, React.ReactNode> = {
  firstName: <User className="h-4 w-4" />,
  lastName: <User className="h-4 w-4" />,
  resume: <FileText className="h-4 w-4" />,
  company: <Building2 className="h-4 w-4" />,
  linkedin: <Linkedin className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  bio: <FileEdit className="h-4 w-4" />,
};

export function ProfileCompletionModal({
  open,
  onOpenChange,
}: ProfileCompletionModalProps) {
  const [, setLocation] = useLocation();
  const {
    profileStatus,
    isComplete,
    completionPercent,
    missingRequired,
    missingNiceToHave,
    snooze,
    isSnoozing,
    getFieldLabel,
  } = useProfileStatus();

  const handleCompleteProfile = () => {
    onOpenChange(false);
    // Navigate to appropriate profile page based on role
    if (profileStatus?.role === "candidate") {
      setLocation("/my-dashboard");
    } else {
      setLocation("/profile/settings");
    }
  };

  const handleSnooze = (days: number) => {
    snooze(days);
    onOpenChange(false);
  };

  if (!profileStatus) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            A complete profile helps you get better matches and makes a great first impression.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-medium">{completionPercent}%</span>
            </div>
            <Progress value={completionPercent} className="h-2" />
          </div>

          {/* Required fields */}
          {missingRequired.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive">Required</h4>
              <ul className="space-y-1">
                {missingRequired.map((field) => (
                  <li key={field} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Circle className="h-3 w-3 text-destructive" />
                    <span className="flex items-center gap-1.5">
                      {fieldIcons[field]}
                      {getFieldLabel(field)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Already completed required fields */}
          {missingRequired.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>All required fields complete!</span>
            </div>
          )}

          {/* Nice-to-have fields */}
          {missingNiceToHave.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Recommended</h4>
              <ul className="space-y-1">
                {missingNiceToHave.map((field) => (
                  <li key={field} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Circle className="h-3 w-3 text-muted-foreground/50" />
                    <span className="flex items-center gap-1.5">
                      {fieldIcons[field]}
                      {getFieldLabel(field)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleCompleteProfile} className="w-full">
            Complete Profile
          </Button>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSnooze(1)}
              disabled={isSnoozing}
              className="flex-1 text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              Tomorrow
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSnooze(7)}
              disabled={isSnoozing}
              className="flex-1 text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              In a week
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
