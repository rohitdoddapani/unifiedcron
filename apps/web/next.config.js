/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        // Proxy API routes to backend, but exclude /api/auth/* which NextAuth handles
        source: '/api/connections/:path*',
        destination: `${apiUrl}/api/connections/:path*`,
      },
      {
        source: '/api/jobs/:path*',
        destination: `${apiUrl}/api/jobs/:path*`,
      },
      {
        source: '/api/alerts/:path*',
        destination: `${apiUrl}/api/alerts/:path*`,
      },
      {
        source: '/api/users/:path*',
        destination: `${apiUrl}/api/users/:path*`,
      },
      {
        source: '/health',
        destination: `${apiUrl}/health`,
      },
      // Note: /api/auth/* routes are handled by NextAuth and should NOT be rewritten
    ];
  },
};

module.exports = nextConfig;
