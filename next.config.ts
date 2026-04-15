import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable", "sharp", "web-push", "node-cron"],
};

export default nextConfig;
