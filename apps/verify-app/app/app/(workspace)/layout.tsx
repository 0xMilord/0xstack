import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_resolveActiveOrg } from "@/lib/services/orgs.service";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAuth();
  const cookieOrg = getActiveOrgIdFromCookies(await cookies());
  const gate = await orgsService_resolveActiveOrg({ userId: viewer.userId, cookieOrgId: cookieOrg });
  if (!gate.ok) redirect("/app/orgs");
  return <>{children}</>;
}
