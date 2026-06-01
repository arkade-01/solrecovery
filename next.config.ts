import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Polyfill the Node.js Buffer for @solana/web3.js in client bundles
    resolveAlias: {
      buffer: "buffer",
    },
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve("buffer/"),
      };
    }
    return config;
  },
};

export default nextConfig;
