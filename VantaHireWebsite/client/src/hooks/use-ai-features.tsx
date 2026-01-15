import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "../lib/queryClient";

export interface AIFeatureStatus {
  resumeAdvisor: boolean;
  fitScoring: boolean;
  queueEnabled: boolean;
}

/**
 * Hook to check AI feature availability
 * Fetches from /api/ai/features which combines feature flags + API key validation
 */
export function useAIFeatures() {
  const {
    data,
    isLoading,
    error,
  } = useQuery<AIFeatureStatus, Error>({
    queryKey: ["/api/ai/features"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });

  return {
    resumeAdvisor: data?.resumeAdvisor ?? false,
    fitScoring: data?.fitScoring ?? false,
    queueEnabled: data?.queueEnabled ?? false,
    isLoading,
    error,
  };
}
