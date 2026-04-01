import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_resolveActiveOrg } from "@/lib/services/orgs.service";

export default async function Page() {
  const viewer = await requireAuth();
  const cookieOrg = getActiveOrgIdFromCookies(await cookies());
  const gate = await orgsService_resolveActiveOrg({ userId: viewer.userId, cookieOrgId: cookieOrg });
  if (!gate.ok) redirect("/app/orgs");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Workspace</h1>
        <p className="text-sm text-muted-foreground">You have an active organization. Open settings, billing, or assets from here.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/settings">
              Settings
            </Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/app/orgs">
              Switch organization
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
