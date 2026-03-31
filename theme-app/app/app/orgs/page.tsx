import { loadMyOrgs } from "@/lib/loaders/orgs.loader";
import { createOrg } from "@/lib/actions/orgs.actions";
import { setActiveOrg } from "@/lib/actions/orgs.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const rows = await loadMyOrgs();
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Organizations</h1>
      <p className="mt-2 text-sm text-muted-foreground">Create an org, select it, then continue into the app.</p>

      <form
        className="mt-6 flex gap-2"
        action={async (fd) => {
          "use server";
          await createOrg({ name: String(fd.get("name") ?? "") });
        }}
      >
        <Input name="name" placeholder="Acme Inc" required minLength={2} />
        <Button type="submit">Create</Button>
      </form>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((r: any) => (
          <Card key={r.org.id}>
            <CardHeader>
              <CardTitle className="text-base">{r.org.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Role: {r.membership.role}</p>
              <form
                action={async () => {
                  "use server";
                  await setActiveOrg({ orgId: r.org.id });
                }}
              >
                <Button type="submit" variant="secondary">
                  Use org
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
