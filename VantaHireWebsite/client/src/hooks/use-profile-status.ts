import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ProfileStatus {
  complete: boolean;
  role: string;
  missingRequired: string[];
  missingNiceToHave: string[];
  completionPercent: number;
  snoozeUntil: string | null;
  shouldShowPrompt: boolean;
  profileCompletedAt: string | null;
}

/**
 * Hook for managing profile completion status and prompts
 */
export function useProfileStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch profile status
  const {
    data: profileStatus,
    isLoading,
    error,
    refetch,
  } = useQuery<ProfileStatus>({
    queryKey: ["/api/profile-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/profile-status");
      if (!res.ok) {
        throw new Error("Failed to fetch profile status");
      }
      return await res.json();
    },
    staleTime: 60_000, // Cache for 1 minute
    refetchOnWindowFocus: true,
  });

  // Snooze profile prompt
  const snoozeMutation = useMutation({
    mutationFn: async (days: number = 7) => {
      const res = await apiRequest("POST", "/api/profile-status/snooze", { days });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to snooze prompt");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ProfileStatus>(["/api/profile-status"], (old) => {
        if (!old) return old;
        return {
          ...old,
          snoozeUntil: data.snoozeUntil,
          shouldShowPrompt: false,
        };
      });
      toast({
        title: "Profile prompt snoozed",
        description: "We'll remind you to complete your profile later.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to snooze",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mark profile as complete
  const markCompleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/profile-status/complete");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to mark profile complete");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ProfileStatus>(["/api/profile-status"], (old) => {
        if (!old) return old;
        return {
          ...old,
          complete: true,
          shouldShowPrompt: false,
          profileCompletedAt: data.profileCompletedAt,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-status"] });
      toast({
        title: "Profile complete",
        description: "Your profile has been marked as complete.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helper to get human-readable field names
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      firstName: "First Name",
      lastName: "Last Name",
      resume: "Resume",
      company: "Company",
      linkedin: "LinkedIn Profile",
      location: "Location",
      bio: "Bio",
    };
    return labels[field] || field;
  };

  return {
    // Data
    profileStatus,
    isLoading,
    error,

    // Computed
    shouldShowPrompt: profileStatus?.shouldShowPrompt ?? false,
    shouldShowBanner: profileStatus?.shouldShowPrompt ?? false,
    isComplete: profileStatus?.complete ?? false,
    completionPercent: profileStatus?.completionPercent ?? 0,
    missingRequired: profileStatus?.missingRequired ?? [],
    missingNiceToHave: profileStatus?.missingNiceToHave ?? [],

    // Actions
    snooze: snoozeMutation.mutate,
    markComplete: markCompleteMutation.mutate,
    refetch,

    // Loading states
    isSnoozing: snoozeMutation.isPending,
    isMarkingComplete: markCompleteMutation.isPending,

    // Helpers
    getFieldLabel,
  };
}
