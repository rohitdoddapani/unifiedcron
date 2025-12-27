"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const platforms = [
  "Supabase",
  "GitHub",
  "Vercel",
  "Netlify",
  "n8n",
];

export function LogoCloud() {
  return (
    <section className="border-y border-zinc-200 bg-zinc-50/50 py-12 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Aggregate cron jobs from your favorite platforms
        </p>
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, staggerChildren: 0.1 }}
        >
          {platforms.map((platform, index) => (
            <motion.div
              key={platform}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Badge
                variant="outline"
                className="cursor-default px-4 py-1.5 text-sm hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
              >
                {platform}
              </Badge>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

