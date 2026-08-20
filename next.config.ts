import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/,
        handler: 'NetworkFirst',
        options: { cacheName: 'firestore-cache' },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  eslint: {
    // ESLint runs separately in CI; don't block the Vercel build
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig);
