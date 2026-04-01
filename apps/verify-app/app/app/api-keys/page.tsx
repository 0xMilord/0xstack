import { loadApiKeysForActiveOrg } from "@/lib/loaders/api-keys.loader";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions/api-keys.actions";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function Page() {
  const { orgId, keys } = await loadApiKeysForActiveOrg();

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-sm text-muted-foreground">Keys are org-scoped. Secrets are only shown once on creation.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create key</CardTitle>
        </CardHeader>
        <CardContent>
          {!orgId ? (
            <p className="text-sm text-muted-foreground">Select an organization first.</p>
          ) : (
            <form
              className="flex gap-2"
              action={async (fd) => {
                "use server";
                await createApiKeyAction({ name: String(fd.get("name") ?? "") });
              }}
            >
              <Input name="name" placeholder="CI key" minLength={2} required />
              <button className={buttonVariants({ variant: "secondary" })} type="submit">
                Create
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {keys.length ? (
            keys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-muted-foreground font-mono text-xs">{k.prefix}…</p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await revokeApiKeyAction({ id: String(k.id) });
                  }}
                >
                  <button className={buttonVariants({ variant: "outline" })} type="submit">
                    Revoke
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No active keys yet.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Tip: external routes accept x-api-key or Authorization: Bearer &lt;key&gt;.</p>
    </main>
  );
}
