import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/downloads/:path*.zip",
        headers: [
          {
            key: "Content-Type",
            value: "application/zip",
          },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="AgencyPulseAgent.zip"',
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
