"use client";

import { Section, SectionHeader } from "@/components/section";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Do I need high-privilege keys?",
    answer:
      "Supabase is the supported integration. It uses a dedicated PostgreSQL reader and private metadata views with verified TLS. Administrator access is needed to install or revoke those grants, but administrator credentials are not stored as a connection. Other providers are planned.",
  },
  {
    question: "Can I self-host?",
    answer:
      "Yes. Single-tenant Docker Compose from day one. Your keys stay on your infrastructure.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "Supabase pg_cron is supported today. GitHub, Vercel, Netlify and n8n integrations are planned and are not yet available in the dashboard.",
  },
  {
    question: "Do you modify my jobs?",
    answer:
      "No. Read-only dashboard + alerts in MVP. We never write to or modify your cron jobs.",
  },
  {
    question: "Private repos?",
    answer:
      "GitHub repository discovery, including private repositories, is planned. It is not currently supported.",
  },
];

export function FAQ() {
  return (
    <Section id="faq" className="bg-white dark:bg-zinc-950">
      <SectionHeader
        badge="FAQ"
        title="Frequently asked questions"
        description="Everything you need to know about UnifiedCron."
      />

      <div className="mx-auto max-w-2xl">
        <Accordion type="single">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger value={`faq-${index}`}>
                {faq.question}
              </AccordionTrigger>
              <AccordionContent value={`faq-${index}`}>
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

