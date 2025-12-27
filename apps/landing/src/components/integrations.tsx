"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";

const integrations = [
  {
    name: "Supabase",
    description: "pg_cron via public views",
  },
  {
    name: "GitHub Actions",
    description: "workflow schedule: triggers",
  },
  {
    name: "Vercel",
    description: "vercel.json functions with schedule",
  },
  {
    name: "Netlify",
    description: "netlify.toml functions with schedule",
  },
  {
    name: "n8n",
    description: "Cron node workflows",
  },
];

export function Integrations() {
  return (
    <Section id="integrations" className="bg-white dark:bg-zinc-950">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeader
            badge="Integrations"
            title="Start with the essentials"
            description="Connect your favorite platforms and aggregate all cron jobs into a single view."
            align="left"
            className="mb-0 lg:mb-0"
          />

          <motion.div
            className="mt-8 space-y-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.1 },
              },
            }}
          >
            {integrations.map((integration) => (
              <motion.div
                key={integration.name}
                className="flex items-start gap-3"
                variants={{
                  hidden: { opacity: 0, x: -10 },
                  visible: { opacity: 1, x: 0 },
                }}
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {integration.name}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {" "}
                    — {integration.description}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
            Private repos supported via provider tokens. Vercel/Netlify read via
            repo or manual file upload.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="overflow-hidden border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 dark:border-emerald-800/30 dark:from-emerald-950/30 dark:to-teal-950/30">
            <CardContent className="p-8">
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                  Self-host or cloud
                </span>
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Self-host or cloud—your choice
              </h3>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Run with Docker Compose, keep secrets on your infra, and revoke
                access any time. We encrypt tokens at rest and mask in logs.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4 text-center">
                <div className="rounded-xl bg-white/80 p-4 dark:bg-zinc-900/50">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    100%
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Self-hosted
                  </div>
                </div>
                <div className="rounded-xl bg-white/80 p-4 dark:bg-zinc-900/50">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    AES-256
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Encrypted at rest
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Section>
  );
}

