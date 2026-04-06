import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureAuthTables } from "../generate/schema-edit";

export const authCoreModule: Module = {
  id: "auth-core",
  install: async () => { },
  activate: async (ctx) => {
    // Always-on auth domain surfaces (Better Auth is always enabled).
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "mutation-keys"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "hooks", "client"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "auth", "viewer"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "auth", "signout"));
    await ensureDir(path.join(ctx.projectRoot, "app", "login"));
    await ensureDir(path.join(ctx.projectRoot, "app", "get-started"));
    await ensureDir(path.join(ctx.projectRoot, "app", "forgot-password"));
    await ensureDir(path.join(ctx.projectRoot, "app", "reset-password"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "auth"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "auth", "[...all]"));

    // Ensure Drizzle tables for auth exist.
    await ensureAuthTables(ctx.projectRoot);

    // Auth schema file for Drizzle access if needed (required by doctor)
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "auth", "auth-schema.ts"),
      `import { user, session, account, verification } from "@/lib/db/schema";

export const authSchema = {
  user,
  session,
  account,
  verification,
};
`
    );

    // Better Auth server instance (base config, email patched by email module if enabled)
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "auth", "auth.ts"),
      `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { env } from "@/lib/env/server";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Send welcome email if email module is enabled
          try {
            const { sendWelcomeEmail } = await import("@/lib/email/auth-emails");
            if (sendWelcomeEmail) {
              await sendWelcomeEmail(user.email, user.name);
            }
          } catch {
            // Email module not enabled — no welcome email
          }
        }
      }
    }
  }
});
`
    );

    // Better Auth client for browser usage
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "auth", "auth-client.ts"),
      `import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
`
    );

    // Better Auth API route handler
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "auth", "[...all]", "route.ts"),
      `import { auth } from "@/lib/auth/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return await auth.handler(request);
}

export async function POST(request: NextRequest) {
  return await auth.handler(request);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "auth.keys.ts"),
      `export const authKeys = {
  all: ["auth"] as const,
  viewer: () => [...authKeys.all, "viewer"] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "mutation-keys", "auth.keys.ts"),
      `export const authMutations = {
  signOut: ["auth", "signOut"] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "viewer.service.ts"),
      `import { auth } from "@/lib/auth/auth";
import { profilesService_ensureForUser } from "@/lib/services/profiles.service";

export type Viewer = {
  userId: string;
  email?: string | null;
  name?: string | null;
} | null;

export async function viewerService_getViewer(headers: Headers) : Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  const user = session?.user;
  if (!user?.id) return null;
  await profilesService_ensureForUser(user.id);
  return { userId: user.id, email: (user as any)?.email ?? null, name: (user as any)?.name ?? null };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "auth.service.ts"),
      `import { auth } from "@/lib/auth/auth";

export async function authService_signOut(headers: Headers) {
  // Better Auth handles cookie/session clearing.
  return await auth.api.signOut({ headers });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "viewer.loader.ts"),
      `import { cache } from "react";
import { headers } from "next/headers";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { viewerService_getViewer } from "@/lib/services/viewer.service";

const loadViewerCached = withServerCache(
  async () => {
    const h = await headers();
    return await viewerService_getViewer(h as any);
  },
  {
    key: () => ["auth", "viewer"],
    tags: () => [cacheTags.viewer],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadViewer = cache(loadViewerCached);
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "auth.actions.ts"),
      `"use server";

import { headers } from "next/headers";
import { authService_signOut } from "@/lib/services/auth.service";
import { revalidate } from "@/lib/cache";

export async function signOutAction() {
  const h = await headers();
  await authService_signOut(h as any);
  revalidate.tag("viewer");
  // Server Action form handlers are best as void-return for broad compatibility.
  return;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "hooks", "client", "use-viewer.ts"),
      `"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "@/lib/query-keys/auth.keys";
import { authMutations } from "@/lib/mutation-keys/auth.keys";

export type ViewerDto = { userId: string; email?: string | null; name?: string | null } | null;

async function fetchViewer(): Promise<ViewerDto> {
  const res = await fetch("/api/v1/auth/viewer", { method: "GET" });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  return json?.viewer ?? null;
}

async function postSignOut() {
  await fetch("/api/v1/auth/signout", { method: "POST" });
}

export function useViewer() {
  return useQuery({ queryKey: authKeys.viewer(), queryFn: fetchViewer, staleTime: 30_000 });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: authMutations.signOut,
    mutationFn: postSignOut,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: authKeys.viewer() });
    },
  });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "auth", "viewer", "route.ts"),
      `import { NextResponse } from "next/server";
import { viewerService_getViewer } from "@/lib/services/viewer.service";

export async function GET(req: Request) {
  const viewer = await viewerService_getViewer(req.headers);
  return NextResponse.json({ ok: true, viewer });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "auth", "signout", "route.ts"),
      `import { NextResponse } from "next/server";
import { authService_signOut } from "@/lib/services/auth.service";

export async function POST(req: Request) {
  await authService_signOut(req.headers);
  return NextResponse.json({ ok: true });
}
`
    );

    // Login page
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "login", "page.tsx"),
      `"use client";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to continue to your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const res = await authClient.signIn.email({ email, password, rememberMe: true, callbackURL: redirect });
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
              autoComplete="current-password"
              required
              minLength={8}
            />
            <div className="flex items-center justify-between">
              <Link className="text-sm text-muted-foreground hover:underline" href="/forgot-password">
                Forgot password?
              </Link>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Working…" : "Sign in"}
            </Button>
            <Link className={buttonVariants({ variant: "ghost" })} href={\`/get-started?redirect=\${encodeURIComponent(redirect)}\`}>
              Need an account? Get started
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
`
    );

    // Get started (signup) page
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "get-started", "page.tsx"),
      `"use client";

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
          <CardDescription>Start with email + password. You'll land in Organizations after signup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const res = await authClient.signUp.email({ 
                  name: name || email, 
                  email, 
                  password,
                  callbackURL: redirect,
                });
                if ((res as any)?.error) throw new Error((res as any).error.message ?? "Authentication failed");
                // After signup, user is redirected to orgs or shown verification message
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
              {pending ? "Creating account…" : "Create account"}
            </Button>
            <Link className={buttonVariants({ variant: "ghost" })} href={\`/login?redirect=\${encodeURIComponent(redirect)}\`}>
              Already have an account? Sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
`
    );

    // Forgot password page
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "forgot-password", "page.tsx"),
      `"use client";

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
          <CardDescription>We'll email you a reset link if the account exists.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError(null);
              try {
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const redirectTo = \`\${origin}/reset-password?redirect=\${encodeURIComponent(redirect)}\`;
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
            {done ? (
              <p className="text-sm text-green-600">Check your email for a reset link.</p>
            ) : (
              <Button type="submit" disabled={pending}>
                {pending ? "Working…" : "Send reset link"}
              </Button>
            )}
            <Link className={buttonVariants({ variant: "ghost" })} href={"/login?redirect=" + encodeURIComponent(redirect)}>
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
`
    );

    // Reset password page
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "reset-password", "page.tsx"),
      `"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

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
              <Link className={buttonVariants({ variant: "outline" })} href={"/forgot-password?redirect=" + encodeURIComponent(redirect)}>
                Request a new link
              </Link>
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
`
    );
  },
  validate: async () => { },
  sync: async () => { },
};

