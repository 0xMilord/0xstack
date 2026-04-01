import { z } from "zod";

export const ObservabilityEnvSchema = z.object({
  // Sentry
  SENTRY_DSN: z.string().min(1).optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
});
