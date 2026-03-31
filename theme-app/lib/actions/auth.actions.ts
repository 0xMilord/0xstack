"use server";

import { headers } from "next/headers";
import { authService_signOut } from "@/lib/services/auth.service";
import { revalidate } from "@/lib/cache";

export async function signOutAction() {
  const h = await headers();
  await authService_signOut(h as any);
  revalidate.tag("viewer");
  return { ok: true as const };
}
