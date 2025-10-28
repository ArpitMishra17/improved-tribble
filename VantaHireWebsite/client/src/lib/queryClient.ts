import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCsrfToken, clearCsrfToken } from "./csrf";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Build headers with CSRF token for mutating requests
  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};

  // Add CSRF token for state-changing operations
  const mutatingMethods = ['POST', 'PATCH', 'DELETE', 'PUT'];
  if (mutatingMethods.includes(method.toUpperCase())) {
    try {
      const csrfToken = await getCsrfToken();
      headers['x-csrf-token'] = csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      throw new Error('CSRF token unavailable');
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(data !== undefined && { body: JSON.stringify(data) }),
    credentials: "include",
  });

  // Clear cached CSRF token on 403 (likely invalid token)
  if (res.status === 403) {
    clearCsrfToken();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
