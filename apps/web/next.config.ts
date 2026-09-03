import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep development output separate from production builds so next dev cannot race next build.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  transpilePackages: ['@quiz-creator/types', '@quiz-creator/core', '@quiz-creator/controllers'],
  reactStrictMode: true,
  experimental: {
    // Keep server manifest writes in the main process for reliable Windows builds.
    webpackBuildWorker: false,
    // Avoid bundling the full icon package for every named icon import.
    optimizePackageImports: ['lucide-react'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
