import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

export const storageGcsModule: Module = {
  id: "storage-gcs",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.storage === "gcs";
    const routes = [
      "app/api/v1/storage/sign-upload/route.ts",
      "app/api/v1/storage/sign-read/route.ts",
      "app/api/v1/storage/assets/route.ts",
      "app/api/v1/storage/assets/[assetId]/route.ts",
    ];
    if (!enabled) {
      for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      await backupAndRemove(ctx.projectRoot, "lib/storage/gcs.ts");
      await backupAndRemove(ctx.projectRoot, "app/app/assets/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/(workspace)/assets/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/(workspace)/assets/assets-client.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/(workspace)/assets/[assetId]/page.tsx");
      await backupAndRemove(ctx.projectRoot, "lib/loaders/assets.loader.ts");
      await backupAndRemove(ctx.projectRoot, "lib/actions/assets.actions.ts");
      return;
    }

    await backupAndRemove(ctx.projectRoot, "app/app/assets/page.tsx");

    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "mutation-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-read"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets", "[assetId]"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "storage.ts"),
      `import { z } from "zod";
\nexport const StorageEnvSchema = z.object({
  GCS_BUCKET: z.string().min(1),
  GCS_PROJECT_ID: z.string().min(1),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "gcs.ts"),
      `import { Storage } from "@google-cloud/storage";
import { env } from "@/lib/env/server";

export function getGcs() {
  return new Storage({ projectId: env.GCS_PROJECT_ID! });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "storage.service.ts"),
      `import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { getGcs } from "@/lib/storage/gcs";
import {
  insertAsset,
  deleteAssetById,
  getAssetById,
  listAssetsForOrg,
  listAssetsForUser,
} from "@/lib/repos/assets.repo";
import type { assets } from "@/lib/db/schema";
import { isMember } from "@/lib/repos/org-members.repo";

export function storageService_buildObjectKey(input: { orgId: string | null; ownerUserId: string | null; filename: string }) {
  const safe =
    (input.filename || "upload.bin").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160) || "upload.bin";
  if (input.orgId) return \`orgs/\${input.orgId}/\${crypto.randomUUID()}-\${safe}\`;
  if (input.ownerUserId) return \`users/\${input.ownerUserId}/\${crypto.randomUUID()}-\${safe}\`;
  throw new Error("object_key_owner_required");
}

export async function storageService_assertCanAccessAsset(input: {
  userId: string;
  activeOrgId: string | null;
  asset: typeof assets.$inferSelect;
}) {
  const a = input.asset;
  if (a.orgId) {
    if (!input.activeOrgId || a.orgId !== input.activeOrgId) throw new Error("forbidden");
    const ok = await isMember(a.orgId, input.userId);
    if (!ok) throw new Error("forbidden");
    return;
  }
  if (a.ownerUserId !== input.userId) throw new Error("forbidden");
}

export async function storageService_createSignedUpload(input: {
  contentType: string;
  objectKey: string;
  ownerUserId: string | null;
  orgId: string | null;
}) {
  const bucket = getGcs().bucket(env.GCS_BUCKET!);
  const file = bucket.file(input.objectKey);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: input.contentType,
  });

  const assetId = crypto.randomUUID();
  await insertAsset({
    id: assetId,
    provider: "gcs",
    ownerUserId: input.ownerUserId,
    orgId: input.orgId,
    bucket: env.GCS_BUCKET!,
    objectKey: input.objectKey,
    contentType: input.contentType,
  });

  return { assetId, bucket: env.GCS_BUCKET!, objectKey: input.objectKey, uploadUrl, expiresInSeconds: 900 };
}

export async function storageService_createSignedRead(input: {
  assetId: string;
  userId?: string | null;
  activeOrgId?: string | null;
}) {
  const asset = await getAssetById(input.assetId);
  if (!asset) throw new Error("Asset not found");
  if (input.userId) {
    await storageService_assertCanAccessAsset({
      userId: input.userId,
      activeOrgId: input.activeOrgId ?? null,
      asset,
    });
  }
  const bucket = getGcs().bucket(asset.bucket);
  const file = bucket.file(asset.objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { url, expiresInSeconds: 600, asset };
}

export async function storageService_getAssetForViewer(input: { assetId: string; userId: string; activeOrgId: string | null }) {
  const asset = await getAssetById(input.assetId);
  if (!asset) return null;
  await storageService_assertCanAccessAsset({ userId: input.userId, activeOrgId: input.activeOrgId, asset });
  return asset;
}

export async function storageService_deleteAsset(input: {
  assetId: string;
  userId?: string | null;
  activeOrgId?: string | null;
}) {
  const existing = await getAssetById(input.assetId);
  if (!existing) return { ok: false as const };
  if (input.userId) {
    await storageService_assertCanAccessAsset({
      userId: input.userId,
      activeOrgId: input.activeOrgId ?? null,
      asset: existing,
    });
  }
  const deleted = await deleteAssetById(input.assetId);
  if (!deleted) return { ok: false as const };
  try {
    const bucket = getGcs().bucket(deleted.bucket);
    await bucket.file(deleted.objectKey).delete({ ignoreNotFound: true });
  } catch {
    // best-effort: DB is source of truth
  }
  return { ok: true as const, deleted };
}

export async function storageService_listAssets(input: { ownerUserId?: string | null; orgId?: string | null }) {
  if (input.orgId) return await listAssetsForOrg(input.orgId);
  if (input.ownerUserId) return await listAssetsForUser(input.ownerUserId);
  return [];
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "assets.loader.ts"),
      `import { cache } from "react";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { storageService_getAssetForViewer, storageService_listAssets } from "@/lib/services/storage.service";

const loadAssetsOrgCached = withServerCache(
  async (orgId: string) => await storageService_listAssets({ orgId }),
  {
    key: (orgId: string) => ["assets", "org", orgId],
    tags: (orgId: string) => [cacheTags.assetsOrg(orgId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadAssetsForActiveOrg = cache(async () => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) return { viewer, orgId: null as string | null, assets: [] as any[] };
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  return { viewer, orgId, assets: await loadAssetsOrgCached(orgId) };
});

export const loadAssetForViewer = cache(async (assetId: string) => {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const asset = await storageService_getAssetForViewer({ assetId, userId: viewer.userId, activeOrgId: orgId });
  return { viewer, orgId, asset };
});
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "assets.actions.ts"),
      `"use server";

import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/server";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { revalidate } from "@/lib/cache";
import { storageService_buildObjectKey, storageService_createSignedRead, storageService_createSignedUpload, storageService_deleteAsset } from "@/lib/services/storage.service";

export async function assetsSignUploadAction(input: { filename: string; contentType: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const objectKey = storageService_buildObjectKey({ orgId, ownerUserId: null, filename: input.filename });
  const signed = await storageService_createSignedUpload({ contentType: input.contentType, objectKey, ownerUserId: viewer.userId, orgId });
  revalidate.assetsForOrg(orgId);
  return signed;
}

export async function assetsSignReadAction(input: { assetId: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const signed = await storageService_createSignedRead({ assetId: input.assetId, userId: viewer.userId, activeOrgId: orgId });
  return { url: signed.url };
}

export async function assetsDeleteAction(input: { assetId: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const res = await storageService_deleteAsset({ assetId: input.assetId, userId: viewer.userId, activeOrgId: orgId });
  if (orgId) revalidate.assetsForOrg(orgId);
  return res;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets", "assets-client.tsx"),
      `"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assetsDeleteAction, assetsSignReadAction, assetsSignUploadAction } from "@/lib/actions/assets.actions";

type Asset = {
  id: string;
  objectKey: string;
  contentType?: string | null;
  createdAt?: string | Date;
};

export function AssetsClient({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...assets].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
    [assets]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input ref={inputRef} type="file" className="cursor-pointer sm:max-w-md" disabled={busy} />
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              const f = inputRef.current?.files?.[0];
              if (!f) return;
              setErr(null);
              start(async () => {
                try {
                  const signed = await assetsSignUploadAction({
                    filename: f.name,
                    contentType: f.type || "application/octet-stream",
                  });
                  const put = await fetch(signed.uploadUrl, {
                    method: "PUT",
                    body: f,
                    headers: { "content-type": f.type || "application/octet-stream" },
                  });
                  if (!put.ok) throw new Error("upload_failed");
                  if (inputRef.current) inputRef.current.value = "";
                  router.refresh();
                } catch (e: any) {
                  setErr(String(e?.message ?? e));
                }
              });
            }}
          >
            {busy ? "Working…" : "Upload"}
          </Button>
        </CardContent>
        {err ? <p className="px-6 pb-4 text-sm text-destructive">{err}</p> : null}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Library</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-sm font-mono">{a.id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="text-foreground">Type:</span> {a.contentType ?? "—"}
                </p>
                <p className="break-all">
                  <span className="text-foreground">Key:</span> {a.objectKey}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy || opening === a.id}
                    onClick={() => {
                      setErr(null);
                      setOpening(a.id);
                      start(async () => {
                        try {
                          const { url } = await assetsSignReadAction({ assetId: a.id });
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (e: any) {
                          setErr(String(e?.message ?? e));
                        } finally {
                          setOpening(null);
                        }
                      });
                    }}
                  >
                    Open
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => router.push("/app/assets/" + encodeURIComponent(a.id))}>
                    Details
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setErr(null);
                      start(async () => {
                        try {
                          await assetsDeleteAction({ assetId: a.id });
                          router.refresh();
                        } catch (e: any) {
                          setErr(String(e?.message ?? e));
                        }
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets", "[assetId]", "page.tsx"),
      `import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAssetForViewer } from "@/lib/loaders/assets.loader";
import { assetsDeleteAction } from "@/lib/actions/assets.actions";

export default async function Page({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const { asset } = await loadAssetForViewer(assetId);
  if (!asset) {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Asset not found</h1>
        <Link className={buttonVariants({ variant: "outline" })} href="/app/assets">Back</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Asset details</h1>
        <p className="text-sm text-muted-foreground font-mono break-all">{asset.id}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Content-Type:</span> {asset.contentType ?? "—"}</p>
          <p className="break-all"><span className="text-muted-foreground">Object key:</span> {asset.objectKey}</p>
          <p><span className="text-muted-foreground">Bucket:</span> {asset.bucket}</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <form action={async () => { "use server"; await assetsDeleteAction({ assetId }); }}>
          <button className={buttonVariants({ variant: "destructive" })} type="submit">Delete</button>
        </form>
        <Link className={buttonVariants({ variant: "outline" })} href="/app/assets">Back</Link>
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets", "page.tsx"),
      `import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { loadAssetsForActiveOrg } from "@/lib/loaders/assets.loader";
import { AssetsClient } from "./assets-client";

export default async function Page() {
  const { orgId, assets } = await loadAssetsForActiveOrg();
  if (!orgId) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">Select an organization first.</p>
        <Link className={buttonVariants({ variant: "secondary" })} href="/app/orgs">Go to organizations</Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">Org-scoped assets (active org cookie).</p>
      </header>
      <AssetsClient assets={assets as any} />
    </main>
  );
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_buildObjectKey, storageService_createSignedUpload } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      const orgId = getActiveOrgIdFromCookies(await cookies());
      if (!orgId) {
        return NextResponse.json(
          { ok: false, requestId, code: "NO_ACTIVE_ORG", message: "Select an organization first (/app/orgs)." },
          { status: 400, headers: { "x-request-id": requestId } }
        );
      }
      await orgsService_assertMember({ userId: session.user.id, orgId });
      const body = (await req.json().catch(() => ({}))) as {
        contentType?: string;
        filename?: string;
      };
      const contentType = body?.contentType ?? "application/octet-stream";
      const objectKey = storageService_buildObjectKey({
        orgId,
        ownerUserId: null,
        filename: typeof body?.filename === "string" ? body.filename : "upload.bin",
      });
      const signed = await storageService_createSignedUpload({
        contentType,
        objectKey,
        ownerUserId: session.user.id,
        orgId,
      });
      return NextResponse.json(
        { ok: true, requestId, ...signed, ownerUserId: session.user.id, orgId },
        { headers: { "x-request-id": requestId } }
      );
    }

    await guardApiRequest(req);

    const body = (await req.json().catch(() => null)) as null | {
      contentType?: string;
      objectKey?: string;
      ownerUserId?: string;
      orgId?: string;
    };
    const contentType = body?.contentType ?? "application/octet-stream";
    const objectKey = body?.objectKey ?? \`uploads/\${crypto.randomUUID()}\`;
    const ownerUserId = body?.ownerUserId ?? null;
    const orgId = body?.orgId ?? null;
    if (!ownerUserId && !orgId) {
      return NextResponse.json(
        { ok: false, requestId, code: "INVALID_INPUT", message: "ownerUserId or orgId is required" },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    const signed = await storageService_createSignedUpload({ contentType, objectKey, ownerUserId, orgId });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        ...signed,
        ownerUserId,
        orgId,
      },
      { headers: { "x-request-id": requestId } }
    );
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-read", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_createSignedRead } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = (await req.json().catch(() => null)) as null | { assetId?: string };
    const assetId = body?.assetId;
    if (!assetId) {
      return NextResponse.json({ ok: false, requestId, code: "INVALID_INPUT", message: "assetId is required" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) {
      const orgId = getActiveOrgIdFromCookies(await cookies());
      const signed = await storageService_createSignedRead({
        assetId,
        userId: session.user.id,
        activeOrgId: orgId,
      });
      return NextResponse.json({ ok: true, requestId, ...signed }, { headers: { "x-request-id": requestId } });
    }

    await guardApiRequest(req);
    const signed = await storageService_createSignedRead({ assetId });
    return NextResponse.json({ ok: true, requestId, ...signed }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "query-keys", "assets.keys.ts"),
      `export const assetsKeys = {
  all: ["assets"] as const,
  mine: () => [...assetsKeys.all, "mine"] as const,
  org: (orgId: string) => [...assetsKeys.all, "org", orgId] as const,
};
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "mutation-keys", "assets.keys.ts"),
      `export const assetsMutations = {
  delete: ["assets", "delete"] as const,
};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { storageService_listAssets } from "@/lib/services/storage.service";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const orgId = getActiveOrgIdFromCookies(await cookies());
  const assets = orgId
    ? await storageService_listAssets({ orgId })
    : await storageService_listAssets({ ownerUserId: session.user.id, orgId: null });
  return NextResponse.json({ ok: true, requestId, assets, scope: orgId ? "org" : "personal" });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { toApiErrorResponse } from "@/lib/security/api";
import { storageService_deleteAsset } from "@/lib/services/storage.service";

export async function DELETE(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, requestId, code: "UNAUTHORIZED", message: "unauthorized" }, { status: 401, headers: { "x-request-id": requestId } });
    }
    const { assetId } = await ctx.params;
    const orgId = getActiveOrgIdFromCookies(await cookies());
    const res = await storageService_deleteAsset({ assetId, userId: session.user.id, activeOrgId: orgId });
    return NextResponse.json({ requestId, ...res }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    // Plug-and-play UI: scoped to active org via cookie (see storage API routes).
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "(workspace)", "assets", "page.tsx"),
      `"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsKeys } from "@/lib/query-keys/assets.keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";

type Asset = {
  id: string;
  bucket: string;
  objectKey: string;
  contentType?: string | null;
  createdAt?: string | Date;
};

async function apiList(): Promise<Asset[]> {
  const res = await fetch("/api/v1/storage/assets", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load assets");
  const json = await res.json();
  return json.assets ?? [];
}

async function apiSignUpload(file: File) {
  const res = await fetch("/api/v1/storage/sign-upload", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contentType: file.type || "application/octet-stream",
      filename: file.name,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json?.message === "string" ? json.message : "Sign upload failed");
  const uploadUrl = json.uploadUrl as string;
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!put.ok) throw new Error("Upload to storage failed");
  return json as { assetId: string };
}

async function apiSignRead(assetId: string): Promise<{ url: string }> {
  const res = await fetch("/api/v1/storage/sign-read", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  if (!res.ok) throw new Error("Failed to sign read URL");
  const json = await res.json();
  return { url: json.url };
}

async function apiDelete(assetId: string) {
  const res = await fetch("/api/v1/storage/assets/" + encodeURIComponent(assetId), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete asset");
}

export default function Page() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [assetId, setAssetId] = useState("");

  const { data, isLoading, error } = useQuery({ queryKey: assetsKeys.mine(), queryFn: apiList });
  const assets = data ?? [];

  const del = useMutation({
    mutationFn: apiDelete,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assetsKeys.mine() });
    },
  });

  const open = useMutation({
    mutationFn: apiSignRead,
    onSuccess: (x) => window.open(x.url, "_blank", "noopener,noreferrer"),
  });

  const upload = useMutation({
    mutationFn: apiSignUpload,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assetsKeys.mine() });
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">
          Uploads use your active organization (cookie). Flow: sign URL → PUT to GCS → refresh list.
        </p>
      </header>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Upload</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input ref={inputRef} type="file" className="cursor-pointer sm:max-w-md" disabled={upload.isPending} />
          <Button
            type="button"
            disabled={upload.isPending}
            onClick={() => {
              const f = inputRef.current?.files?.[0];
              if (f) upload.mutate(f);
            }}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </CardContent>
        {upload.isError ? <p className="px-6 pb-4 text-sm text-destructive">{String(upload.error)}</p> : null}
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">By asset id</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">Asset ID</label>
            <Input value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="paste asset id…" />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={!assetId || open.isPending} onClick={() => open.mutate(assetId)}>
              Open
            </Button>
            <Button type="button" variant="destructive" disabled={!assetId || del.isPending} onClick={() => del.mutate(assetId)}>
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Library</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {assets.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-sm font-mono">{a.id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="text-foreground">Type:</span> {a.contentType ?? "—"}
                </p>
                <p className="break-all">
                  <span className="text-foreground">Key:</span> {a.objectKey}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => open.mutate(a.id)}>
                    Open
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => del.mutate(a.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
`
    );
  },
  validate: async () => {},
  sync: async () => {},
};

