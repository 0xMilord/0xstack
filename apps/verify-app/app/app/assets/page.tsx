import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { loadAssetsForActiveOrg } from "@/lib/loaders/assets.loader";
import { AssetsClient } from "./assets-client";

export default async function Page() {
  const { orgId, assets } = await loadAssetsForActiveOrg();
  if (!orgId) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">Select an organization first.</p>
        <Link className={buttonVariants({ variant: "secondary" })} href="/app/orgs">Go to organizations</Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">Org-scoped assets (active org cookie). Upload uses signed URLs to your configured provider.</p>
      </header>
      <AssetsClient assets={assets as any} />
    </main>
  );
}
