import Link from "next/link";
import { Clock } from "lucide-react";
import { getAppUrl } from "@/lib/utils";

const footerLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/status", label: "Status" },
  { href: "/privacy", label: "Privacy" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Left - Logo & Copyright */}
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600">
              <Clock className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              © {currentYear} UnifiedCron
            </span>
          </div>

          {/* Center - Links */}
          <nav className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right - Sign in */}
          <Link
            href={getAppUrl("/auth/signin")}
            className="text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            data-attr="footer-signin"
          >
            Sign in →
          </Link>
        </div>
      </div>
    </footer>
  );
}

