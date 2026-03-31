import { z } from "zod";

import { BillingEnvSchema } from "./billing";

import { StorageEnvSchema } from "./storage";

export const EnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  API_KEY: z.string().min(10).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
}).and(BillingEnvSchema.partial()).and(StorageEnvSchema.partial());
