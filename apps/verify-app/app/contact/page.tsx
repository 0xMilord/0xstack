import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
        <p className="text-sm text-muted-foreground">Drop your support email, Discord, or a contact form here.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Update this page in your app with the channels your team actually uses (email, ticketing, chat).
        </CardContent>
      </Card>
    </main>
  );
}
