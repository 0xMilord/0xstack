"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Page() {
  const sp = useSearchParams();
  const redirect = useMemo(() => sp.get("redirect") ?? "/app/orgs", [sp]);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We’ll email you a reset link if the account exists.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const origin = window.location.origin;
                const redirectTo = `${origin}/reset-password?redirect=${encodeURIComponent(redirect)}`;
                const res = await authClient.requestPasswordReset({ email, redirectTo });
                if ((res as any)?.error) throw new Error((res as any).error.message ?? "Request failed");
                setDone(true);
              } catch (err: any) {
                setError(err?.message ?? "Something went wrong");
              } finally {
                setPending(false);
              }
            }}
          >
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending || done}>
              {done ? "Email sent (if account exists)" : pending ? "Working…" : "Send reset link"}
            </Button>
            <Link className={buttonVariants({ variant: "ghost" })} href={"/login?redirect=" + encodeURIComponent(redirect)}>
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
