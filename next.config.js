/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    webpackBuildWorker: true,
  },

  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await originalEntry();
        if (entries["main.js"] && !entries["main.js"].includes("./lib/sw.js")) {
          entries["sw"] = "./lib/sw.js";
        }
        return entries;
      };
    }
    return config;
  },

  output: "standalone",
  reactStrictMode: true,

  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
