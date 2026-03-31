import path from "node:path";
import { ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const authCoreModule: Module = {
  id: "auth-core",
  install: async () => {},
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

export type Viewer = {
  userId: string;
  email?: string | null;
  name?: string | null;
} | null;

export async function viewerService_getViewer(headers: Headers) : Promise<Viewer> {
  const session = await auth.api.getSession({ headers });
  const user = session?.user;
  if (!user?.id) return null;
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
  return { ok: true as const };
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
  },
  validate: async () => {},
  sync: async () => {},
};

