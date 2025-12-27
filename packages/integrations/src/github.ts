/**
 * TODO: GitHub Actions integration - Coming in a future release
 * Currently disabled for Supabase-first MVP
 */

import * as yaml from 'js-yaml';
import { ParsedJob } from '@unifiedcron/shared';

interface GitHubWorkflow {
  name?: string;
  on?: {
    schedule?: Array<{ cron: string }>;
  };
}

interface GitHubFile {
  name: string;
  path: string;
  type: string;
  download_url: string;
}

/**
 * Parses GitHub workflow YAML content to extract cron jobs
 */
export function parseGithubWorkflowYml(yamlText: string): ParsedJob[] {
  try {
    const workflow = yaml.load(yamlText) as GitHubWorkflow;
    if (!workflow) {
      return [];
    }

    const name = workflow.name || 'Unnamed Workflow';
    const schedules = workflow.on?.schedule || [];
    
    return schedules
      .filter(schedule => schedule.cron)
      .map(schedule => ({
        name,
        cron: schedule.cron,
        metadata: {
          workflowName: name,
          schedule: schedule.cron
        }
      }));
  } catch (error) {
    console.error('Error parsing GitHub workflow YAML:', error);
    return [];
  }
}

/**
 * Fetches and parses GitHub workflows from a repository
 */
export async function fetchGithubWorkflows(
  owner: string,
  repo: string,
  token: string
): Promise<ParsedJob[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'UnifiedCron/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const files = await response.json() as GitHubFile[];
    const jobs: ParsedJob[] = [];

    for (const file of files) {
      if (file.type === 'file' && file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
        try {
          const fileResponse = await fetch(file.download_url, {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'UnifiedCron/1.0'
            }
          });

          if (fileResponse.ok) {
            const yamlContent = await fileResponse.text();
            const parsedJobs = parseGithubWorkflowYml(yamlContent);
            
            // Add file path to metadata
            parsedJobs.forEach(job => {
              job.metadata = {
                ...job.metadata,
                filePath: file.path,
                fileName: file.name
              };
            });

            jobs.push(...parsedJobs);
          }
        } catch (error) {
          console.error(`Error fetching workflow file ${file.name}:`, error);
        }
      }
    }

    return jobs;
  } catch (error) {
    console.error('Error fetching GitHub workflows:', error);
    throw error;
  }
}

/**
 * Validates GitHub repository access
 */
export async function validateGithubAccess(
  owner: string,
  repo: string,
  token: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'UnifiedCron/1.0'
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error validating GitHub access:', error);
    return false;
  }
}
