"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
  animate?: boolean;
}

export function Section({
  id,
  className,
  containerClassName,
  children,
  animate = true,
}: SectionProps) {
  const content = (
    <div
      className={cn(
        "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8",
        containerClassName
      )}
    >
      {children}
    </div>
  );

  if (!animate) {
    return (
      <section id={id} className={cn("py-20 lg:py-28", className)}>
        {content}
      </section>
    );
  }

  return (
    <motion.section
      id={id}
      className={cn("py-20 lg:py-28", className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {content}
    </motion.section>
  );
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  title,
  description,
  badge,
  align = "center",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-12 lg:mb-16",
        align === "center" && "mx-auto max-w-2xl text-center",
        className
      )}
    >
      {badge && (
        <span className="mb-4 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          {badge}
        </span>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
    </div>
  );
}

