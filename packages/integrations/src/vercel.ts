import { ParsedJob } from '@unifiedcron/shared';

interface VercelFunction {
  schedule?: string;
}

interface VercelConfig {
  functions?: Record<string, VercelFunction>;
}

interface GitHubFileContent {
  content: string;
  encoding: string;
}

/**
 * Parses Vercel JSON configuration to extract scheduled functions
 */
export function parseVercelJson(jsonText: string): ParsedJob[] {
  try {
    const config = JSON.parse(jsonText) as VercelConfig;
    if (!config.functions) {
      return [];
    }

    const jobs: ParsedJob[] = [];
    
    for (const [functionPath, functionConfig] of Object.entries(config.functions)) {
      if (functionConfig && typeof functionConfig === 'object' && 'schedule' in functionConfig) {
        const schedule = functionConfig.schedule;
        if (schedule && typeof schedule === 'string') {
          jobs.push({
            name: functionPath,
            cron: schedule,
            metadata: {
              functionPath,
              platform: 'vercel',
              schedule
            }
          });
        }
      }
    }

    return jobs;
  } catch (error) {
    console.error('Error parsing Vercel JSON:', error);
    return [];
  }
}

/**
 * Fetches vercel.json from a GitHub repository
 */
export async function fetchVercelConfigFromGithub(
  owner: string,
  repo: string,
  token: string
): Promise<ParsedJob[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/vercel.json`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'UnifiedCron/1.0'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // vercel.json doesn't exist, which is fine
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const file = await response.json() as GitHubFileContent;
    
    // Decode base64 content
    const jsonContent = Buffer.from(file.content, 'base64').toString('utf8');
    
    return parseVercelJson(jsonContent);
  } catch (error) {
    console.error('Error fetching Vercel config from GitHub:', error);
    return [];
  }
}

/**
 * Parses Vercel configuration from uploaded file content
 */
export function parseVercelConfigFile(content: string): ParsedJob[] {
  return parseVercelJson(content);
}
