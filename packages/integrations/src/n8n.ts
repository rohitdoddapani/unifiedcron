import { ParsedJob } from '@unifiedcron/shared';

interface N8nNode {
  name: string;
  type: string;
  parameters?: {
    rule?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface N8nWorkflow {
  id: string;
  name: string;
  nodes: N8nNode[];
  active: boolean;
}

/**
 * Extracts cron jobs from an n8n workflow
 */
export function extractCronFromN8nWorkflow(workflow: N8nWorkflow): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  
  if (!workflow.nodes) {
    return jobs;
  }

  for (const node of workflow.nodes) {
    // Check for various cron-related node types
    if (node.type && (
      node.type.includes('Cron') || 
      node.type.includes('Schedule') ||
      node.type === 'n8n-nodes-base.cron'
    )) {
      const schedule = node.parameters?.rule;
      if (schedule && typeof schedule === 'string') {
        jobs.push({
          name: `${workflow.name} / ${node.name}`,
          cron: schedule,
          metadata: {
            workflowId: workflow.id,
            workflowName: workflow.name,
            nodeName: node.name,
            nodeType: node.type,
            nodeId: node.id,
            parameters: node.parameters
          }
        });
      }
    }
  }

  return jobs;
}

/**
 * Fetches workflows from n8n instance
 */
export async function fetchN8nWorkflows(
  baseUrl: string,
  apiKey: string
): Promise<ParsedJob[]> {
  try {
    // Try different API endpoints based on n8n version
    const endpoints = [
      `${baseUrl}/api/v1/workflows`,
      `${baseUrl}/rest/workflows`
    ];

    let workflows: N8nWorkflow[] = [];
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          workflows = await response.json() as N8nWorkflow[];
          break;
        } else if (response.status === 404) {
          // Try next endpoint
          continue;
        } else {
          throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    if (workflows.length === 0 && lastError) {
      throw lastError;
    }

    // Extract cron jobs from all workflows
    const allJobs: ParsedJob[] = [];
    for (const workflow of workflows) {
      if (workflow.active) { // Only process active workflows
        const jobs = extractCronFromN8nWorkflow(workflow);
        allJobs.push(...jobs);
      }
    }

    return allJobs;
  } catch (error) {
    console.error('Error fetching n8n workflows:', error);
    throw error;
  }
}

/**
 * Validates n8n instance access
 */
export async function validateN8nAccess(
  baseUrl: string,
  apiKey: string
): Promise<boolean> {
  try {
    const endpoints = [
      `${baseUrl}/api/v1/workflows`,
      `${baseUrl}/rest/workflows`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'HEAD',
          headers: {
            'X-N8N-API-KEY': apiKey,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Try next endpoint
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error('Error validating n8n access:', error);
    return false;
  }
}
