import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep development output separate from production builds so next dev cannot race next build.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  transpilePackages: ['@quiz-creator/types', '@quiz-creator/core', '@quiz-creator/controllers'],
  reactStrictMode: true,
  experimental: {
    // Keep server manifest writes in the main process for reliable Windows builds.
    webpackBuildWorker: false,
    // Avoid bundling the full icon package for every named icon import.
    optimizePackageImports: ['lucide-react', '@quiz-creator/core', '@quiz-creator/controllers'],
  },
  typescript: {
    ignoreBuildErrors: true,
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