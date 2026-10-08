import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@xyflow/react", "date-fns"],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
