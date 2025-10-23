// CSRF token management for client-side requests
let cachedToken: string | null = null;

/**
 * Fetches and caches the CSRF token from the server
 * Token is cached in memory to avoid repeated requests
 */
export async function getCsrfToken(): Promise<string> {
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.token;
    return cachedToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Clears the cached CSRF token
 * Call this on authentication changes or CSRF errors
 */
export function clearCsrfToken(): void {
  cachedToken = null;
}

/**
 * Adds CSRF token to request headers
 * Use this for JSON requests
 */
export async function addCsrfHeader(headers: HeadersInit = {}): Promise<HeadersInit> {
  const token = await getCsrfToken();
  return {
    ...headers,
    'x-csrf-token': token,
  };
}

/**
 * Adds CSRF token to FormData
 * Use this for multipart/form-data requests
 */
export async function addCsrfToFormData(formData: FormData): Promise<FormData> {
  const token = await getCsrfToken();
  formData.append('_csrf', token);
  return formData;
}
