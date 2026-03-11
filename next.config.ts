import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    serverExternalPackages: ["castv2-client", "bonjour-service"],
};

export default nextConfig;
