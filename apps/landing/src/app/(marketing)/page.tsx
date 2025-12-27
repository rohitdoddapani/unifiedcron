import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import { LogoCloud } from "@/components/logo-cloud";
import { Features } from "@/components/features";
import { HowItWorks } from "@/components/how-it-works";
import { Integrations } from "@/components/integrations";
import { Screenshots } from "@/components/screenshots";
import { CTABand } from "@/components/cta-band";
import { FAQ } from "@/components/faq";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://unifiedcron.com";

export const metadata: Metadata = {
  title: "UnifiedCron - One dashboard for all your cron jobs",
  description:
    "Discover, monitor, and get alerts for scheduled tasks across Supabase, GitHub, Vercel, Netlify, and n8n—without giving up your keys.",
  keywords: [
    "cron jobs",
    "scheduled tasks",
    "monitoring",
    "supabase",
    "github actions",
    "vercel",
    "netlify",
    "n8n",
    "developer tools",
    "devops",
  ],
  authors: [{ name: "UnifiedCron" }],
  creator: "UnifiedCron",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "UnifiedCron - One dashboard for all your cron jobs",
    description:
      "Discover, monitor, and get alerts for scheduled tasks across Supabase, GitHub, Vercel, Netlify, and n8n—without giving up your keys.",
    siteName: "UnifiedCron",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "UnifiedCron - Centralized cron job monitoring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UnifiedCron - One dashboard for all your cron jobs",
    description:
      "Discover, monitor, and get alerts for scheduled tasks across Supabase, GitHub, Vercel, Netlify, and n8n.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UnifiedCron",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "UnifiedCron",
      description:
        "A developer tool that centralizes cron jobs from many platforms into one dashboard",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Unified visibility across platforms",
        "Read-only by default",
        "Failure alerts",
        "Self-hosting support",
        "Human-readable schedules",
        "Easy to extend",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "UnifiedCron",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <LogoCloud />
      <Features />
      <HowItWorks />
      <Integrations />
      <Screenshots />
      <CTABand />
      <FAQ />
    </>
  );
}

