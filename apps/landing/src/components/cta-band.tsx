"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppUrl } from "@/lib/utils";

export function CTABand() {
  return (
    <section className="relative overflow-hidden bg-zinc-900 py-20 lg:py-28 dark:bg-zinc-950">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950" />
        <div
          className="absolute -left-[10%] top-0 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -right-[10%] bottom-0 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl"
          aria-hidden="true"
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
            <Sparkles className="h-4 w-4" />
            Free to get started
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Connect a source in minutes
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            Start monitoring your cron jobs today. No credit card required.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="min-w-[180px] bg-white text-zinc-900 shadow-xl hover:bg-zinc-100"
              asChild
            >
              <Link href={getAppUrl("/auth/signin")} data-attr="cta-get-started">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-w-[180px] border-zinc-700 bg-transparent text-white hover:bg-zinc-800"
              asChild
            >
              <Link href={getAppUrl("/connections")} data-attr="cta-add-connection">
                Add a connection
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

