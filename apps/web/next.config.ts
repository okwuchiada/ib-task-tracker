import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@task-tracker/shared'],
};

export default nextConfig;
