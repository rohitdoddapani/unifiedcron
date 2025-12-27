import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the app URL for CTAs that link to the main web app
 * In production, set NEXT_PUBLIC_APP_URL to point to your deployed web app
 */
export function getAppUrl(path: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${appUrl}${path}`;
}

