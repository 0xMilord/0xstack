import { z } from "zod";

export const createApiKeyInput = z.object({
  name: z.string().min(2).max(80),
});

export const revokeApiKeyInput = z.object({
  id: z.string().min(1),
});
