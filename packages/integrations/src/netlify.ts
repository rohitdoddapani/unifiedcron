import * as toml from 'toml';
import { ParsedJob } from '@unifiedcron/shared';

interface NetlifyFunction {
  path?: string;
  schedule?: string;
}

interface NetlifyConfig {
  functions?: NetlifyFunction | NetlifyFunction[];
}

/**
 * Parses Netlify TOML configuration to extract scheduled functions
 */
export function parseNetlifyToml(tomlText: string): ParsedJob[] {
  try {
    const config = toml.parse(tomlText) as NetlifyConfig;
    if (!config.functions) {
      return [];
    }

    const jobs: ParsedJob[] = [];
    const functions = Array.isArray(config.functions) ? config.functions : [config.functions];

    for (const func of functions) {
      if (func && func.schedule) {
        jobs.push({
          name: func.path || 'function',
          cron: func.schedule,
          metadata: {
            functionPath: func.path,
            platform: 'netlify',
            schedule: func.schedule
          }
        });
      }
    }

    return jobs;
  } catch (error) {
    console.error('Error parsing Netlify TOML:', error);
    return [];
  }
}

/**
 * Fetches netlify.toml from a GitHub repository
 */
export async function fetchNetlifyConfigFromGithub(
  owner: string,
  repo: string,
  token: string
): Promise<ParsedJob[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/netlify.toml`,
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
        // netlify.toml doesn't exist, which is fine
        return [];
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const file = await response.json();
    
    // Decode base64 content
    const tomlContent = Buffer.from(file.content, 'base64').toString('utf8');
    
    return parseNetlifyToml(tomlContent);
  } catch (error) {
    console.error('Error fetching Netlify config from GitHub:', error);
    return [];
  }
}

/**
 * Parses Netlify configuration from uploaded file content
 */
export function parseNetlifyConfigFile(content: string): ParsedJob[] {
  return parseNetlifyToml(content);
}
