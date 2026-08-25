import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace packages ship raw TS (no build step of their own) — Next
  // needs to transpile them itself rather than treating them as pre-built.
  transpilePackages: ["@careconnect/shared-types", "@careconnect/validation"],
  experimental: {
    serverActions: {
      // Default is 1MB, too small for the vault upload form (a single phone
      // photo of a prescription routinely runs 2-8MB) — this Server Action
      // is the only multipart upload in the app. Matches the API's own
      // FileInterceptor limit in vault.controller.ts; keep both in sync.
      bodySizeLimit: "10mb",
    },
  },
};

export default withNextIntl(nextConfig);
