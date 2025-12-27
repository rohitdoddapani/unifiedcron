"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppUrl } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] overflow-hidden pt-24 lg:pt-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 via-white to-emerald-50/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20" />
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 opacity-30 blur-3xl dark:opacity-20"
          aria-hidden="true"
        >
          <div className="aspect-[1155/678] w-[72rem] bg-gradient-to-tr from-emerald-200 to-teal-300 dark:from-emerald-800 dark:to-teal-900" />
        </div>
        {/* Grid pattern */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]"
          aria-hidden="true"
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Zap className="h-3.5 w-3.5" />
              Now supporting Supabase, GitHub, Vercel, Netlify & n8n
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="mt-8 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl dark:text-zinc-50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            One dashboard for all your{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
              cron jobs
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="mt-6 text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Discover, monitor, and get alerts for scheduled tasks across
            Supabase, GitHub, Vercel, Netlify, and n8n—without giving up your
            keys.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Button size="lg" className="min-w-[160px]" asChild>
              <Link href={getAppUrl("/auth/signin")} data-attr="hero-get-started">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="min-w-[160px]" asChild>
              <Link href={getAppUrl("/connections")} data-attr="hero-connect">
                Connect a source
              </Link>
            </Button>
          </motion.div>

          {/* Tertiary link */}
          <motion.div
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link
              href={getAppUrl("/jobs")}
              className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-700 hover:underline dark:text-zinc-500 dark:hover:text-zinc-300"
              data-attr="hero-view-jobs"
            >
              View jobs →
            </Link>
          </motion.div>
        </div>

        {/* Hero visual placeholder */}
        <motion.div
          className="mt-16 lg:mt-24"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          <div className="relative mx-auto aspect-[16/9] max-w-4xl overflow-hidden rounded-2xl border border-zinc-200 bg-white/50 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-zinc-950/50">
            {/* Mock dashboard UI */}
            <div className="absolute inset-0 p-4">
              {/* Mock header */}
              <div className="flex items-center justify-between rounded-lg bg-zinc-100/80 px-4 py-2 dark:bg-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <div className="h-2 w-24 rounded bg-zinc-300 dark:bg-zinc-600" />
                </div>
                <div className="flex gap-2">
                  <div className="h-2 w-16 rounded bg-zinc-300 dark:bg-zinc-600" />
                  <div className="h-2 w-16 rounded bg-zinc-300 dark:bg-zinc-600" />
                </div>
              </div>
              {/* Mock table rows */}
              <div className="mt-4 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg bg-zinc-50/80 px-4 py-3 dark:bg-zinc-800/50"
                    style={{ opacity: 1 - i * 0.15 }}
                  >
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    <div className="h-2 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-2 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="h-2 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
                    <div className="ml-auto h-2 w-16 rounded bg-emerald-200 dark:bg-emerald-800/50" />
                  </div>
                ))}
              </div>
            </div>
            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-50 to-transparent dark:from-zinc-950" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

