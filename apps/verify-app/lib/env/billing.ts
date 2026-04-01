import { z } from "zod";

export const BillingEnvSchema = z.object({
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
  DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]),
  DODO_PAYMENTS_RETURN_URL: z.string().url(),
  // Used by /pricing. Dodo "price id" or equivalent identifier (per your Dodo dashboard).
  DODO_PAYMENTS_STARTER_PRICE_ID: z.string().min(1),
  // Optional: JSON plan registry for multiple plans.
  // Example: [{"id":"starter","name":"Starter","priceId":"price_xxx","features":["..."]}]
  DODO_PAYMENTS_PLANS_JSON: z.string().min(1).optional(),
});
