import type { NextConfig } from "next";
import { join } from "node:path";
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../.."),
  transpilePackages: ["@jornada/shared"],
  async redirects() {
    return [{ source: "/praticar", destination: "/exercitar", permanent: true }, { source: "/admin/lista/convites", destination: "/admin/lista/exercicios", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ] }];
  },
};
export default nextConfig;
