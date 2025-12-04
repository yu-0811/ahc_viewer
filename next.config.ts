import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Workspace root is the repository top-level (not the parent directory)
    root: __dirname,
  },
};

export default nextConfig;
