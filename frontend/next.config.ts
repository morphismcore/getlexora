import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => {
    return Date.now().toString();
  },
  headers: async () => [
    {
      // HTML sayfalarında cache'i kapat — her deploy'dan sonra taze içerik gelsin
      source: "/:path*",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
      ],
    },
    {
      // Static assets (JS/CSS) — hash'li, 1 yıl cache OK
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
};

export default nextConfig;
