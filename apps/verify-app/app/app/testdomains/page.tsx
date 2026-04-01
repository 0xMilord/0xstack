import { loadTestdomainList } from "@/lib/loaders/testdomains.loader";
import { createTestdomain } from "@/lib/actions/testdomains.actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const items = await loadTestdomainList();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Testdomain</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage testdomains.</p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-3 sm:flex-row"
        action={async (fd) => {
          "use server";
          await createTestdomain({ name: String(fd.get("name") ?? "") });
        }}
      >
        <Input name="name" placeholder="name" required />
        <Button type="submit">Create</Button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it: any) => (
          <Card key={String(it.id)}>
            <CardHeader>
              <CardTitle className="text-base">{String(it.name ?? it.id)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">id: {String(it.id)}</CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
