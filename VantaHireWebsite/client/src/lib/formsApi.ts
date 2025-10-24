/**
 * Typed API client for Forms feature
 * Provides strongly-typed wrappers around API endpoints with automatic DTO inference
 */

import { apiRequest } from './queryClient';
import type {
  FormTemplateDTO,
  FormInvitationDTO,
  FormResponseSummaryDTO,
  FormResponseDetailDTO,
  PublicFormDTO,
  FileUploadResult,
  FormAnswer,
} from '@shared/forms.types';

// ==================== Error Types ====================

/**
 * Discriminated union for API errors
 * Allows exhaustive error handling via switch statements
 */
export type FormsApiError =
  | { type: 'expired'; status: 410; code: 'FORM_EXPIRED'; message: string }
  | { type: 'already_submitted'; status: 409; code: 'ALREADY_SUBMITTED'; message: string }
  | { type: 'invalid_token'; status: 403; code: 'INVALID_TOKEN'; message: string }
  | { type: 'rate_limited'; status: 429; code: 'RATE_LIMITED'; message: string }
  | { type: 'validation_error'; status: 400; code: 'VALIDATION_ERROR'; message: string }
  | { type: 'not_found'; status: 404; code: 'NOT_FOUND'; message: string }
  | { type: 'unauthorized'; status: 401 | 403; code: 'UNAUTHORIZED'; message: string }
  | { type: 'server_error'; status: 500; code: 'SERVER_ERROR'; message: string }
  | { type: 'network_error'; status: 0; code: 'NETWORK_ERROR'; message: string };

/**
 * Type guard to check if error is a FormsApiError
 */
export function isFormsApiError(error: unknown): error is FormsApiError {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as FormsApiError;
  return typeof err.type === 'string' &&
         typeof err.status === 'number' &&
         typeof err.code === 'string' &&
         typeof err.message === 'string';
}

/**
 * Parse error response into discriminated union
 */
async function parseApiError(response: Response): Promise<FormsApiError> {
  try {
    const data = await response.json();
    const message = data.error || data.message || response.statusText;

    // Map status codes to error types
    switch (response.status) {
      case 410:
        return { type: 'expired', status: 410, code: data.code || 'FORM_EXPIRED', message };
      case 409:
        return { type: 'already_submitted', status: 409, code: data.code || 'ALREADY_SUBMITTED', message };
      case 403:
        return data.code === 'INVALID_TOKEN'
          ? { type: 'invalid_token', status: 403, code: 'INVALID_TOKEN', message }
          : { type: 'unauthorized', status: 403, code: 'UNAUTHORIZED', message };
      case 429:
        return { type: 'rate_limited', status: 429, code: data.code || 'RATE_LIMITED', message };
      case 400:
        return { type: 'validation_error', status: 400, code: data.code || 'VALIDATION_ERROR', message };
      case 404:
        return { type: 'not_found', status: 404, code: 'NOT_FOUND', message };
      case 401:
        return { type: 'unauthorized', status: 401, code: 'UNAUTHORIZED', message };
      case 500:
        return { type: 'server_error', status: 500, code: data.code || 'SERVER_ERROR', message };
      default:
        return { type: 'server_error', status: response.status, code: 'SERVER_ERROR', message };
    }
  } catch {
    return {
      type: 'server_error',
      status: response.status,
      code: 'SERVER_ERROR',
      message: response.statusText || 'Unknown error'
    };
  }
}

// ==================== Endpoint Response Types ====================

export interface ListTemplatesResponse {
  templates: FormTemplateDTO[];
}

export interface ListInvitationsResponse {
  invitations: FormInvitationDTO[];
}

export interface ListResponsesResponse {
  responses: FormResponseSummaryDTO[];
}

export interface CreateInvitationRequest {
  applicationId: number;
  formId: number;
  customMessage?: string;
}

export interface CreateInvitationResponse {
  invitation: FormInvitationDTO;
}

export interface SubmitFormRequest {
  answers: FormAnswer[];
}

export interface SubmitFormResponse {
  success: boolean;
  message: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  isPublished?: boolean;
  fields: Array<{
    type: string;
    label: string;
    required: boolean;
    options?: string;
    order: number;
  }>;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  isPublished?: boolean;
  fields?: Array<{
    type: string;
    label: string;
    required: boolean;
    options?: string;
    order: number;
  }>;
}

export interface DeleteTemplateResponse {
  success: boolean;
  message: string;
}

// ==================== Type-safe API Client ====================

export const formsApi = {
  /**
   * Fetch all form templates (published templates + own drafts for recruiters, all for admins)
   */
  async listTemplates(): Promise<ListTemplatesResponse> {
    const res = await fetch('/api/forms/templates', {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch templates: ${res.statusText}`);
    return res.json();
  },

  /**
   * Fetch single template by ID
   */
  async getTemplate(id: number): Promise<FormTemplateDTO> {
    const res = await fetch(`/api/forms/templates/${id}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch template: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create new form template
   */
  async createTemplate(data: CreateTemplateRequest): Promise<FormTemplateDTO> {
    const res = await apiRequest('POST', '/api/forms/templates', data);
    return res.json();
  },

  /**
   * Update existing form template
   */
  async updateTemplate(id: number, data: UpdateTemplateRequest): Promise<FormTemplateDTO> {
    const res = await apiRequest('PATCH', `/api/forms/templates/${id}`, data);
    return res.json();
  },

  /**
   * Delete form template (only if no invitations exist)
   */
  async deleteTemplate(id: number): Promise<DeleteTemplateResponse> {
    const res = await apiRequest('DELETE', `/api/forms/templates/${id}`, {});
    return res.json();
  },

  /**
   * Fetch invitations for a specific application
   */
  async listInvitations(applicationId: number): Promise<ListInvitationsResponse> {
    const res = await fetch(`/api/forms/invitations?applicationId=${applicationId}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch invitations: ${res.statusText}`);
    return res.json();
  },

  /**
   * Create and send a form invitation
   */
  async createInvitation(data: CreateInvitationRequest): Promise<CreateInvitationResponse> {
    const res = await apiRequest('POST', '/api/forms/invitations', data);
    return res.json();
  },

  /**
   * Fetch response summaries for an application
   */
  async listResponses(applicationId: number): Promise<ListResponsesResponse> {
    const res = await fetch(`/api/forms/responses?applicationId=${applicationId}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch responses: ${res.statusText}`);
    return res.json();
  },

  /**
   * Fetch detailed response with Q&A
   */
  async getResponseDetail(responseId: number): Promise<FormResponseDetailDTO> {
    const res = await fetch(`/api/forms/responses/${responseId}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch response detail: ${res.statusText}`);
    return res.json();
  },

  /**
   * Export responses to CSV
   */
  async exportResponses(applicationId: number, format: 'csv' = 'csv'): Promise<Blob> {
    const res = await fetch(`/api/forms/export?applicationId=${applicationId}&format=${format}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to export responses: ${res.statusText}`);
    return res.blob();
  },

  // ==================== Public Form Endpoints (no auth) ====================

  /**
   * Fetch public form data by token
   * @throws {FormsApiError} Typed error with discriminated union for exhaustive handling
   */
  async getPublicForm(token: string): Promise<PublicFormDTO> {
    try {
      const res = await fetch(`/api/forms/public/${token}`);
      if (!res.ok) {
        throw await parseApiError(res);
      }
      return res.json();
    } catch (error) {
      if (isFormsApiError(error)) throw error;
      throw { type: 'network_error', status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' } as FormsApiError;
    }
  },

  /**
   * Upload file for public form (before submission)
   * @throws {FormsApiError} Typed error with discriminated union for exhaustive handling
   */
  async uploadPublicFile(token: string, file: File): Promise<FileUploadResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/forms/public/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw await parseApiError(res);
      }

      return res.json();
    } catch (error) {
      if (isFormsApiError(error)) throw error;
      throw { type: 'network_error', status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' } as FormsApiError;
    }
  },

  /**
   * Submit public form answers
   * @throws {FormsApiError} Typed error with discriminated union for exhaustive handling
   */
  async submitPublicForm(token: string, data: SubmitFormRequest): Promise<SubmitFormResponse> {
    try {
      const res = await fetch(`/api/forms/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw await parseApiError(res);
      }

      return res.json();
    } catch (error) {
      if (isFormsApiError(error)) throw error;
      throw { type: 'network_error', status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' } as FormsApiError;
    }
  },
} as const;

// ==================== Query Key Helpers ====================

/**
 * Standardized query keys for React Query
 * Usage: queryKey: formsQueryKeys.templates()
 */
export const formsQueryKeys = {
  templates: () => ['/api/forms/templates'] as const,
  templateDetail: (templateId: number) => [`/api/forms/templates/${templateId}`] as const,
  invitations: (applicationId: number) => [`/api/forms/invitations?applicationId=${applicationId}`] as const,
  responses: (applicationId: number) => [`/api/forms/responses?applicationId=${applicationId}`] as const,
  responseDetail: (responseId: number) => [`/api/forms/responses/${responseId}`] as const,
  publicForm: (token: string) => [`/api/forms/public/${token}`] as const,
} as const;
