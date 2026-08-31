import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@quiz-creator/types', '@quiz-creator/core', '@quiz-creator/controllers'],
  reactStrictMode: true,
};

export default nextConfig;
