"use client";

import { motion } from "framer-motion";
import { ImageIcon } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";

const screenshots = [
  {
    title: "Jobs Dashboard",
    description: "platform, project, job, cron, next run",
  },
  {
    title: "Connections",
    description: "quick add & resync",
  },
];

export function Screenshots() {
  return (
    <Section className="bg-zinc-50 dark:bg-zinc-900/50">
      <SectionHeader
        badge="Preview"
        title="See it in action"
        description="A clean interface designed for developers who value simplicity."
      />

      <motion.div
        className="grid gap-8 md:grid-cols-2"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.2 },
          },
        }}
      >
        {screenshots.map((screenshot) => (
          <motion.div
            key={screenshot.title}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Placeholder screenshot area */}
                <div className="relative aspect-[4/3] border-b border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400 dark:text-zinc-500">
                    <ImageIcon className="h-12 w-12" />
                    <span className="text-sm font-medium">
                      Drop screenshot here
                    </span>
                  </div>
                </div>
                {/* Caption */}
                <div className="p-4">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {screenshot.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {screenshot.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}

