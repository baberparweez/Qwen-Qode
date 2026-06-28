/** @type {import('next').NextConfig} */
const nextConfig = {
  // This is a nested app (root project has its own package-lock.json).
  // Pin the tracing root to this folder to silence the multi-lockfile warning.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
