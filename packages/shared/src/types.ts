import { z } from 'zod';

// Platform types
export const PlatformSchema = z.enum(['supabase', 'github', 'vercel', 'netlify', 'n8n']);
export type Platform = z.infer<typeof PlatformSchema>;

// Connection types
export const ConnectionConfigSchema = z.object({
  projectUrl: z.string().optional(),
  anonKey: z.string().optional(),
  repo: z.string().optional(),
  token: z.string().optional(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
}).passthrough(); // Allow additional platform-specific fields

export type ConnectionConfig = z.infer<typeof ConnectionConfigSchema>;

export const ConnectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: PlatformSchema,
  label: z.string(),
  config: ConnectionConfigSchema,
  createdAt: z.date(),
});

export type Connection = z.infer<typeof ConnectionSchema>;

// Job types
export const JobSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  originId: z.string(),
  name: z.string(),
  cron: z.string(),
  platform: PlatformSchema,
  project: z.string(),
  metadata: z.record(z.any()),
  lastSeenAt: z.date(),
});

export type Job = z.infer<typeof JobSchema>;

// Job Run types
export const JobRunStatusSchema = z.enum(['succeeded', 'failed', 'running']);
export type JobRunStatus = z.infer<typeof JobRunStatusSchema>;

export const JobRunSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  status: JobRunStatusSchema,
  startedAt: z.date(),
  endedAt: z.date().optional(),
  message: z.string().optional(),
});

export type JobRun = z.infer<typeof JobRunSchema>;

// Alert types
export const AlertTypeSchema = z.enum(['failure']);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  type: AlertTypeSchema,
  createdAt: z.date(),
  details: z.record(z.any()),
});

export type Alert = z.infer<typeof AlertSchema>;

// Parsed job types for each platform
export const ParsedJobSchema = z.object({
  name: z.string(),
  cron: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type ParsedJob = z.infer<typeof ParsedJobSchema>;

// API Response types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

// User types
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().optional(),
  createdAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
