import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAppVersion } from '../../scripts/generate-version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appVersion = resolveAppVersion();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development output separate from production builds so next dev cannot race next build.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  transpilePackages: ['@quiz-creator/types', '@quiz-creator/core', '@quiz-creator/controllers'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';
    return [
      {
        source: '/version.json',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://api.groq.com https://generativelanguage.googleapis.com https://*.supabase.co https://*.neon.tech; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
    ];
  },
  experimental: {
    // Keep server manifest writes in the main process for reliable Windows builds.
    webpackBuildWorker: false,
    // Avoid bundling the full icon package for every named icon import.
    optimizePackageImports: ['lucide-react', '@quiz-creator/core', '@quiz-creator/controllers'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    resolveAlias: {
      canvas: './lib/empty.ts',
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      canvas: false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;