"use client";

import { motion } from "framer-motion";
import {
  Eye,
  Shield,
  Bell,
  Server,
  Clock,
  Puzzle,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/section";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const features = [
  {
    icon: Eye,
    title: "Unified visibility",
    description:
      "See every cron job in one clean table—no more hopping between platforms.",
  },
  {
    icon: Shield,
    title: "Read-only by default",
    description:
      "Connect via public views or repo read tokens. Keep full control of your data.",
  },
  {
    icon: Bell,
    title: "Failure alerts (MVP)",
    description:
      "Detect failed runs for Supabase pg_cron and get notified by email or Slack.",
  },
  {
    icon: Server,
    title: "Self-host from day one",
    description:
      "Single-tenant by design. Docker Compose ready. Your keys stay with you.",
  },
  {
    icon: Clock,
    title: "Human-readable schedules",
    description:
      "We parse cron strings and show clear next-run times in your timezone.",
  },
  {
    icon: Puzzle,
    title: "Simple to extend",
    description:
      "Bring your own provider with small parser functions and a normalized job model.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export function Features() {
  return (
    <Section id="features" className="bg-white dark:bg-zinc-950">
      <SectionHeader
        badge="Features"
        title="Everything you need to manage cron jobs"
        description="A developer-friendly dashboard that brings all your scheduled tasks together in one place."
      />

      <motion.div
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <motion.div key={feature.title} variants={itemVariants}>
              <Card className="group h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-zinc-900/5 dark:hover:shadow-zinc-950/50">
                <CardHeader className="pb-4">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white dark:bg-emerald-900/30 dark:text-emerald-400 dark:group-hover:bg-emerald-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </Section>
  );
}

