import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'pino'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://i.scdn.co https://mosaic.scdn.co https://image-cdn-ak.spotifycdn.com https://image-cdn-fa.spotifycdn.com https://wrapped-images.spotifycdn.com https://images.unsplash.com blob:",
              "connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://i.scdn.co https://mosaic.scdn.co https://image-cdn-ak.spotifycdn.com https://image-cdn-fa.spotifycdn.com https://wrapped-images.spotifycdn.com",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "worker-src 'self'",
              "manifest-src 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
