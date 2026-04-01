import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";

export type Viewer = { userId: string } | null;

export const getViewer = cache(async (): Promise<Viewer> => {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const userId = session?.user?.id;
  return userId ? { userId } : null;
});

export async function requireAuth(): Promise<{ userId: string }> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Unauthorized");
  return viewer;
}
