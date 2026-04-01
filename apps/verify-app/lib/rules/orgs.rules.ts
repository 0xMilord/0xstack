import { z } from "zod";

export const createOrgInput = z.object({
  name: z.string().min(2).max(80),
});
