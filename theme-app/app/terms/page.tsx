import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="space-y-4">
        <p className="text-sm text-muted-foreground">Production-ready Next.js + Postgres starter</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms</h1>
        <p className="max-w-2xl text-muted-foreground">Clear rules for using the product and service.</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/get-started">Get started</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">Pricing</Link>
          </Button>
        </div>
      </header>

      <Section title="Highlights">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Tiered architecture", d: "Repos -> services -> actions/loaders -> UI, with boundary checks." },
            { t: "Security baseline", d: "Request IDs, guarded APIs, and hardened defaults from day one." },
            { t: "Enterprise modules", d: "SEO, MDX blog, billing, storage—activated only when enabled." },
          ].map((x) => (
            <Card key={x.t}>
              <CardHeader>
                <CardTitle className="text-base">{x.t}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{x.d}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="FAQ">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { q: "Is this production-ready?", a: "Yes—no placeholders. You get real wiring and migrations." },
            { q: "Can I turn modules on/off?", a: "Yes. Modules are installed but gated by config." },
            { q: "How do DB writes happen?", a: "Internal: server actions. External: versioned HTTP routes." },
            { q: "Auth IDs?", a: "Better Auth uses text IDs; schema and tables follow that." },
          ].map((x) => (
            <Card key={x.q}>
              <CardHeader>
                <CardTitle className="text-base">{x.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{x.a}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <section className="mt-10 rounded-lg border p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold">Ready to ship?</p>
            <p className="text-sm text-muted-foreground">Run init -> baseline -> doctor and deploy.</p>
          </div>
          <Button asChild>
            <Link href="/get-started">Start now</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
