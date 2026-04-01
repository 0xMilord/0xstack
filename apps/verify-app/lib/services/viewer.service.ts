import { auth } from "@/lib/auth/auth";
import { profilesService_ensureForUser } from "@/lib/services/profiles.service";

export type Viewer = {
  userId: string;
  email?: string | null;
  name?: string | null;
} | null;

export async function viewerService_getViewer(headers: Headers) : Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  const user = session?.user;
  if (!user?.id) return null;
  await profilesService_ensureForUser(user.id);
  return { userId: user.id, email: (user as any)?.email ?? null, name: (user as any)?.name ?? null };
}
