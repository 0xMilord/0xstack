import { env } from "@/lib/env/server";

export const SEO_MODULE_ENABLED = true as const;

export function getSeoRuntimeConfig() {
  return {
    enabled: true as const,
    siteUrl: env.NEXT_PUBLIC_APP_URL,
  };
}
