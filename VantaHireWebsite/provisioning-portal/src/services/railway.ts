/**
 * Railway GraphQL API client
 *
 * Uses template-based provisioning for reliable one-click deploys.
 * Templates include: web + worker + Postgres + Redis with proper wiring.
 *
 * API Endpoint: https://backboard.railway.com/graphql/v2
 * Auth: Bearer token (Team token or Personal token)
 */

import { config } from '../config.js';

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

/**
 * Execute a Railway GraphQL query/mutation
 */
async function railwayQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.RAILWAY_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Railway API HTTP error: ${response.status} ${response.statusText}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const errorMessages = result.errors.map((e) => e.message).join('; ');
    throw new Error(`Railway API Error: ${errorMessages}`);
  }

  if (!result.data) {
    throw new Error('Railway API returned no data');
  }

  return result.data;
}

// ============================================
// TEMPLATE-BASED PROVISIONING
// ============================================

export interface TemplateDeployResult {
  projectId: string;
  workflowId: string;
}

/**
 * Deploy from a Railway template
 *
 * This is the recommended approach for SaaS provisioning.
 * The template should include: web, worker, Postgres, Redis
 * with all the proper service linking and variable references.
 *
 * Template setup:
 * 1. Create a Railway project manually with ideal config
 * 2. Publish as a template
 * 3. Use the template ID here
 */
export async function deployFromTemplate(params: {
  templateId: string;
  projectName: string;
  teamId?: string;
}): Promise<TemplateDeployResult> {
  const query = `
    mutation TemplateDeploy($input: TemplateDeployInput!) {
      templateDeploy(input: $input) {
        projectId
        workflowId
      }
    }
  `;

  const data = await railwayQuery<{ templateDeploy: TemplateDeployResult }>(query, {
    input: {
      templateId: params.templateId,
      ...(params.teamId && { teamId: params.teamId }),
      // Note: projectName may not be directly settable via template deploy
      // May need to rename after deployment
    },
  });

  return data.templateDeploy;
}

// ============================================
// PROJECT OPERATIONS
// ============================================

export interface Project {
  id: string;
  name: string;
  environments: {
    edges: Array<{
      node: {
        id: string;
        name: string;
      };
    }>;
  };
  services: {
    edges: Array<{
      node: {
        id: string;
        name: string;
      };
    }>;
  };
}

/**
 * Get project details including environments and services
 */
export async function getProject(projectId: string): Promise<Project> {
  const query = `
    query Project($id: String!) {
      project(id: $id) {
        id
        name
        environments {
          edges {
            node {
              id
              name
            }
          }
        }
        services {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    }
  `;

  const data = await railwayQuery<{ project: Project }>(query, { id: projectId });
  return data.project;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a template-deployed project to become queryable/stable.
 *
 * In practice, templateDeploy returns quickly and services/environments may
 * take a short time to appear. This prevents provisioning jobs from failing
 * due to transient "missing service" races.
 */
export async function waitForProjectReady(params: {
  projectId: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<Project> {
  const timeoutMs = params.timeoutMs ?? 2 * 60 * 1000;
  const pollMs = params.pollMs ?? 2000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const project = await getProject(params.projectId);
    const hasEnv = project.environments.edges.length > 0;
    const hasServices = project.services.edges.length > 0;
    if (hasEnv && hasServices) return project;
    await sleep(pollMs);
  }

  throw new Error(`Timed out waiting for Railway project to become ready: ${params.projectId}`);
}

/**
 * Rename a project
 */
export async function renameProject(projectId: string, name: string): Promise<void> {
  const query = `
    mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
      projectUpdate(id: $id, input: $input) {
        id
        name
      }
    }
  `;

  await railwayQuery(query, {
    id: projectId,
    input: { name },
  });
}

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

/**
 * Set environment variables for a service
 *
 * Note: After template deployment, DATABASE_URL and REDIS_URL
 * are typically auto-wired via Railway's variable references.
 * We only need to set customer-specific variables.
 */
export async function setServiceVariables(params: {
  projectId: string;
  environmentId: string;
  serviceId: string;
  variables: Record<string, string>;
}): Promise<void> {
  const query = `
    mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
  `;

  await railwayQuery(query, {
    input: {
      projectId: params.projectId,
      environmentId: params.environmentId,
      serviceId: params.serviceId,
      variables: params.variables,
    },
  });
}

/**
 * Set variables for multiple services at once
 */
export async function setProjectVariables(params: {
  projectId: string;
  environmentId: string;
  serviceVariables: Array<{
    serviceId: string;
    variables: Record<string, string>;
  }>;
}): Promise<void> {
  // Railway doesn't have a batch endpoint, so we do sequential calls
  for (const sv of params.serviceVariables) {
    await setServiceVariables({
      projectId: params.projectId,
      environmentId: params.environmentId,
      serviceId: sv.serviceId,
      variables: sv.variables,
    });
  }
}

// ============================================
// DOMAINS
// ============================================

export interface ServiceDomain {
  id: string;
  domain: string;
}

/**
 * Create a Railway-provided domain for a service
 */
export async function createServiceDomain(params: {
  serviceId: string;
  environmentId: string;
}): Promise<ServiceDomain> {
  const query = `
    mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
      serviceDomainCreate(input: $input) {
        id
        domain
      }
    }
  `;

  const data = await railwayQuery<{ serviceDomainCreate: ServiceDomain }>(query, {
    input: {
      serviceId: params.serviceId,
      environmentId: params.environmentId,
    },
  });

  return data.serviceDomainCreate;
}

/**
 * Get domains for a service
 */
export async function getServiceDomains(params: {
  projectId: string;
  serviceId: string;
  environmentId: string;
}): Promise<string[]> {
  const query = `
    query ServiceDomains($projectId: String!, $serviceId: String!, $environmentId: String!) {
      project(id: $projectId) {
        service(id: $serviceId) {
          domains(environmentId: $environmentId) {
            serviceDomains {
              domain
            }
          }
        }
      }
    }
  `;

  const data = await railwayQuery<{
    project: {
      service: {
        domains: {
          serviceDomains: Array<{ domain: string }>;
        };
      };
    };
  }>(query, params);

  return data.project.service.domains.serviceDomains.map((d) => d.domain);
}

// ============================================
// DEPLOYMENTS
// ============================================

export interface Deployment {
  id: string;
  status: string;
}

/**
 * Trigger a new deployment for a service
 */
export async function triggerDeployment(params: {
  serviceId: string;
  environmentId: string;
}): Promise<Deployment> {
  const query = `
    mutation DeploymentTrigger($input: DeploymentTriggerInput!) {
      deploymentTrigger(input: $input) {
        id
        status
      }
    }
  `;

  const data = await railwayQuery<{ deploymentTrigger: Deployment }>(query, {
    input: {
      serviceId: params.serviceId,
      environmentId: params.environmentId,
    },
  });

  return data.deploymentTrigger;
}

/**
 * Get deployment status
 */
export async function getDeployment(deploymentId: string): Promise<Deployment> {
  const query = `
    query Deployment($id: String!) {
      deployment(id: $id) {
        id
        status
      }
    }
  `;

  const data = await railwayQuery<{ deployment: Deployment }>(query, { id: deploymentId });
  return data.deployment;
}

// ============================================
// WORKFLOW TRACKING (for template deploys)
// ============================================

/**
 * Check if a template deployment workflow is complete
 * Note: This may require polling or webhook integration
 */
export async function isWorkflowComplete(workflowId: string): Promise<boolean> {
  // Railway's workflow status checking
  // This is a placeholder - actual implementation depends on Railway's API
  // You may need to poll project status or use Railway webhooks

  // For now, we'll check if the project has services deployed
  // In production, implement proper workflow status checking
  console.log(`Checking workflow status: ${workflowId}`);
  return true; // Placeholder
}

// ============================================
// HELPER: Customer slug from email
// ============================================

export function customerSlug(email: string): string {
  return email
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 20);
}

/**
 * Generate a unique project name for a customer
 */
export function generateProjectName(email: string): string {
  const slug = customerSlug(email);
  const timestamp = Date.now().toString(36); // Base36 for shorter string
  return `vantahire-${slug}-${timestamp}`;
}
