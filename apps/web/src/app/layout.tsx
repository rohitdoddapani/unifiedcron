import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { UserMenu } from '@/components/auth/UserMenu';

export const metadata: Metadata = {
  title: 'UnifiedCron - Centralized Cron Job Management',
  description: 'A developer tool that centralizes cron jobs from many platforms into one dashboard',
  keywords: ['cron', 'scheduler', 'monitoring', 'developer tools', 'automation'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <SessionProvider>
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-wrap justify-between items-center min-h-16 gap-2 py-2">
                  <div className="flex items-center">
                    <h1 className="text-xl font-bold text-gray-900">
                      UnifiedCron
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <nav className="flex flex-wrap gap-1">
                      <a
                        href="/"
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Dashboard
                      </a>
                      <a
                        href="/connections"
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Connections
                      </a>
                      <a
                        href="/jobs"
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Jobs
                      </a>
                      <a
                        href="/alerts"
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                      >
                        Alerts
                      </a>
                      <a href="/notifications" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                        Notifications
                      </a>
                    </nav>
                    <UserMenu />
                  </div>
                </div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
