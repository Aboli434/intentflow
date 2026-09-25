import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@intentflow/types', '@intentflow/validation', '@intentflow/config'],
};

export default nextConfig;
