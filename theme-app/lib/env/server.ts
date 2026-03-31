import { EnvSchema } from "./schema";

export const env = EnvSchema.parse(process.env);
