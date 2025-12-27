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
      "No. MVP uses read-only public views for Supabase and repo read tokens for GitHub. Vercel/Netlify via repo or file upload.",
  },
  {
    question: "Can I self-host?",
    answer:
      "Yes. Single-tenant Docker Compose from day one. Your keys stay on your infrastructure.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "Supabase, GitHub, Vercel, Netlify, and n8n. More platforms are coming soon.",
  },
  {
    question: "Do you modify my jobs?",
    answer:
      "No. Read-only dashboard + alerts in MVP. We never write to or modify your cron jobs.",
  },
  {
    question: "Private repos?",
    answer:
      "Yes, via provider tokens with read scope. We only request the minimum permissions needed.",
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

