"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = useMemo(() => sp.get("redirect") ?? "/app/orgs", [sp]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start with email + password. You’ll land in Organizations after signup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const res =
                  await authClient.signUp.email({ name: name || email, email, password });
                if ((res as any)?.error) throw new Error((res as any).error.message ?? "Authentication failed");
                router.push(redirect);
                router.refresh();
              } catch (err: any) {
                setError(err?.message ?? "Something went wrong");
              } finally {
                setPending(false);
              }
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="name" />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : "Create account"}
            </Button>
            <Link className={buttonVariants({ variant: "ghost" })} href={`/login?redirect=${encodeURIComponent(redirect)}`}>
              Already have an account? Sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
