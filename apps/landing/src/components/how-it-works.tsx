"use client";

import { motion } from "framer-motion";
import { Link2, RefreshCw, Bell } from "lucide-react";
import { Section, SectionHeader } from "@/components/section";

const steps = [
  {
    icon: Link2,
    step: "01",
    title: "Connect",
    description: "Add Supabase, GitHub, Vercel, Netlify, or n8n.",
  },
  {
    icon: RefreshCw,
    step: "02",
    title: "Sync",
    description: "We parse cron schedules and normalize them.",
  },
  {
    icon: Bell,
    step: "03",
    title: "Monitor & Alert",
    description: "See jobs in one view; get notified on failures.",
  },
];

export function HowItWorks() {
  return (
    <Section className="bg-zinc-50 dark:bg-zinc-900/50">
      <SectionHeader
        badge="How it works"
        title="Get started in minutes"
        description="Three simple steps to unified cron job monitoring."
      />

      <div className="relative">
        {/* Connecting line (desktop) */}
        <div
          className="absolute left-0 right-0 top-[60px] hidden h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent lg:block dark:via-emerald-700"
          aria-hidden="true"
        />

        <motion.div
          className="grid gap-8 lg:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.2,
              },
            },
          }}
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.step}
                className="relative text-center"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                {/* Step number badge */}
                <div className="relative mx-auto mb-6">
                  <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                    <Icon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow-lg">
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </Section>
  );
}

