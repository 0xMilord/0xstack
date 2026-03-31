"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";
  const redirect = useMemo(() => sp.get("redirect") ?? "/app/orgs", [sp]);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Set a new password to regain access.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Missing reset token. Use the link from your email.</p>
              <Button asChild variant="outline">
                <Link href={"/forgot-password?redirect=" + encodeURIComponent(redirect)}>Request a new link</Link>
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setPending(true);
                setError(null);
                try {
                  const res = await authClient.resetPassword({ newPassword, token });
                  if ((res as any)?.error) throw new Error((res as any).error.message ?? "Reset failed");
                  router.push("/login?redirect=" + encodeURIComponent(redirect));
                  router.refresh();
                } catch (err: any) {
                  setError(err?.message ?? "Something went wrong");
                } finally {
                  setPending(false);
                }
              }}
            >
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                required
                minLength={8}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : "Reset password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
