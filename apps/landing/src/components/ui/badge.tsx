import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "accent";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
        {
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400":
            variant === "default",
          "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300":
            variant === "secondary",
          "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300":
            variant === "outline",
          "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm":
            variant === "accent",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };

