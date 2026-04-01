import { ensureUserProfile } from "@/lib/repos/user-profiles.repo";

export async function profilesService_ensureForUser(userId: string) {
  return await ensureUserProfile(userId);
}
