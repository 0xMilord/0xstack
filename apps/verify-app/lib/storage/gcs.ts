import { Storage } from "@google-cloud/storage";
import { env } from "@/lib/env/server";

export function getGcs() {
  return new Storage({ projectId: env.GCS_PROJECT_ID! });
}
