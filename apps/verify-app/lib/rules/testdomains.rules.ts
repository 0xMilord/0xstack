import { z } from "zod";

export const createTestdomainInput = z.object({
  name: z.string().min(1).max(200),
});

export const updateTestdomainInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
});

export const deleteTestdomainInput = z.object({
  id: z.string().min(1),
});
