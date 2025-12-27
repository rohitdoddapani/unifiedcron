import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { UserMenu } from '@/components/auth/UserMenu';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <SessionProvider>
          <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-bold text-gray-900">
                      UnifiedCron
                    </h1>
                  </div>
                  <div className="flex items-center space-x-8">
                    <nav className="flex space-x-8">
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
                        className="text-gray-400 px-3 py-2 rounded-md text-sm font-medium cursor-not-allowed"
                        title="Coming soon - Monitoring and alerts will be available in a future release"
                      >
                        Alerts <span className="text-xs">(Coming Soon)</span>
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
