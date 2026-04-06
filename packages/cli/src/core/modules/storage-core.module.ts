import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

function storageEnabled(ctx: { modules: { storage: false | "gcs" | "s3" | "supabase" } }) {
  return ctx.modules.storage !== false;
}

export const storageCoreModule: Module = {
  id: "storage-core",
  install: async () => { },
  activate: async (ctx) => {
    const enabled = storageEnabled(ctx);
    const routes = [
      "app/api/v1/storage/sign-upload/route.ts",
      "app/api/v1/storage/sign-read/route.ts",
      "app/api/v1/storage/assets/route.ts",
      "app/api/v1/storage/assets/[assetId]/route.ts",
    ];

    if (!enabled) {
      for (const r of routes) await backupAndRemove(ctx.projectRoot, r);
      await backupAndRemove(ctx.projectRoot, "lib/storage/runtime.ts");
      await backupAndRemove(ctx.projectRoot, "lib/storage/provider.ts");
      await backupAndRemove(ctx.projectRoot, "lib/services/storage.service.ts");
      await backupAndRemove(ctx.projectRoot, "lib/loaders/assets.loader.ts");
      await backupAndRemove(ctx.projectRoot, "lib/actions/assets.actions.ts");
      await backupAndRemove(ctx.projectRoot, "lib/query-keys/assets.keys.ts");
      await backupAndRemove(ctx.projectRoot, "lib/mutation-keys/assets.keys.ts");
      await backupAndRemove(ctx.projectRoot, "app/app/assets/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/assets/assets-client.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/assets/[assetId]/page.tsx");
      return;
    }

    const provider = ctx.modules.storage;

    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "mutation-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-read"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "assets"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "assets", "[assetId]"));

    // In older versions, the assets UI lived elsewhere; keep a defensive cleanup hook.
    await backupAndRemove(ctx.projectRoot, "app/app/(workspace)/assets/page.tsx");

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "runtime.ts"),
      `export type ActiveStorageProvider = "gcs" | "s3" | "supabase";

export const ACTIVE_STORAGE_PROVIDER: ActiveStorageProvider = ${JSON.stringify(provider)};
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "storage", "provider.ts"),
      `export type ProviderSignUploadResult = {
  uploadUrl: string;
  /** Extra headers for the upload request (e.g. Supabase upload token). */
  headers?: Record<string, string>;
};

export type ProviderSignReadResult = { url: string };
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "storage.service.ts"),
      `import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { ACTIVE_STORAGE_PROVIDER } from "@/lib/storage/runtime";
import {
  insertAsset,
  deleteAssetById,
  getAssetById,
  listAssetsForOrg,
  listAssetsForUser,
} from "@/lib/repos/assets.repo";
import type { assets } from "@/lib/db/schema";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import type { ProviderSignUploadResult } from "@/lib/storage/provider";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB server-side limit

function storageBucket(): string {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return env.GCS_BUCKET!;
    case "s3":
      return env.S3_BUCKET!;
    case "supabase":
      return env.SUPABASE_STORAGE_BUCKET!;
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

async function providerSignUpload(input: { objectKey: string; contentType: string; maxBytes?: number }): Promise<ProviderSignUploadResult> {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return (await import("@/lib/storage/providers/gcs")).providerSignUpload(input);
    case "s3":
      return (await import("@/lib/storage/providers/s3")).providerSignUpload(input);
    case "supabase":
      return (await import("@/lib/storage/providers/supabase")).providerSignUpload(input);
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

async function providerSignRead(input: { bucket: string; objectKey: string }) {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return (await import("@/lib/storage/providers/gcs")).providerSignRead(input);
    case "s3":
      return (await import("@/lib/storage/providers/s3")).providerSignRead(input);
    case "supabase":
      return (await import("@/lib/storage/providers/supabase")).providerSignRead(input);
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

async function providerDeleteObject(input: { bucket: string; objectKey: string }) {
  switch (ACTIVE_STORAGE_PROVIDER) {
    case "gcs":
      return (await import("@/lib/storage/providers/gcs")).providerDeleteObject(input);
    case "s3":
      return (await import("@/lib/storage/providers/s3")).providerDeleteObject(input);
    case "supabase":
      return (await import("@/lib/storage/providers/supabase")).providerDeleteObject(input);
    default: {
      const _exhaustive: never = ACTIVE_STORAGE_PROVIDER;
      return _exhaustive;
    }
  }
}

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
    await orgsService_assertMember({ userId: input.userId, orgId: a.orgId });
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
  const bucket = storageBucket();
  const signed = await providerSignUpload({ objectKey: input.objectKey, contentType: input.contentType, maxBytes: MAX_UPLOAD_BYTES });
  const headers: Record<string, string> = {
    ...(signed.headers ?? {}),
  };
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = input.contentType;
  }

  const assetId = crypto.randomUUID();
  await insertAsset({
    id: assetId,
    provider: ACTIVE_STORAGE_PROVIDER,
    ownerUserId: input.ownerUserId,
    orgId: input.orgId,
    bucket,
    objectKey: input.objectKey,
    contentType: input.contentType,
  });

  return {
    assetId,
    bucket,
    objectKey: input.objectKey,
    uploadUrl: signed.uploadUrl,
    uploadHeaders: headers,
    expiresInSeconds: 900,
  };
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
  const { url } = await providerSignRead({ bucket: asset.bucket, objectKey: asset.objectKey });
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
    await providerDeleteObject({ bucket: deleted.bucket, objectKey: deleted.objectKey });
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
import {
  storageService_buildObjectKey,
  storageService_createSignedRead,
  storageService_createSignedUpload,
  storageService_deleteAsset,
} from "@/lib/services/storage.service";

export async function assetsSignUploadAction(input: { filename: string; contentType: string }) {
  const viewer = await requireAuth();
  const orgId = getActiveOrgIdFromCookies(await cookies());
  if (!orgId) throw new Error("no_active_org");
  await orgsService_assertMember({ userId: viewer.userId, orgId });
  const objectKey = storageService_buildObjectKey({ orgId, ownerUserId: null, filename: input.filename });
  const signed = await storageService_createSignedUpload({
    contentType: input.contentType,
    objectKey,
    ownerUserId: viewer.userId,
    orgId,
  });
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
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { toApiErrorResponse } from "@/lib/security/api";
import { storageService_buildObjectKey, storageService_createSignedUpload } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, requestId, code: "UNAUTHORIZED", message: "session required for uploads" },
        { status: 401, headers: { "x-request-id": requestId } }
      );
    }

    const orgId = getActiveOrgIdFromCookies(await cookies());
    if (!orgId) {
      return NextResponse.json(
        { ok: false, requestId, code: "NO_ACTIVE_ORG", message: "Select an organization first (/app/orgs)." },
        { status: 400, headers: { "x-request-id": requestId } }
      );
    }

    // Verify org membership before allowing uploads
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
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { toApiErrorResponse } from "@/lib/security/api";
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
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, requestId, code: "UNAUTHORIZED", message: "session required" }, { status: 401 });
    }

    const orgId = getActiveOrgIdFromCookies(await cookies());

    // If org-scoped asset, verify membership
    if (orgId) {
      try {
        await orgsService_assertMember({ userId: session.user.id, orgId });
      } catch {
        return NextResponse.json({ ok: false, requestId, code: "NOT_ORG_MEMBER", message: "not a member of this org" }, { status: 403 });
      }
    }

    const signed = await storageService_createSignedRead({
      assetId,
      userId: session.user.id,
      activeOrgId: orgId,
    });
    return NextResponse.json({ ok: true, requestId, ...signed }, { headers: { "x-request-id": requestId } });
  } catch (err) {
    return toApiErrorResponse(err, requestId);
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getActiveOrgIdFromCookies } from "@/lib/orgs/active-org";
import { orgsService_assertMember } from "@/lib/services/orgs.service";
import { storageService_listAssets } from "@/lib/services/storage.service";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const orgId = getActiveOrgIdFromCookies(await cookies());

  // If org-scoped, verify membership
  if (orgId) {
    try {
      await orgsService_assertMember({ userId: session.user.id, orgId });
    } catch {
      return NextResponse.json({ ok: false, requestId, error: "not_org_member" }, { status: 403 });
    }
  }

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

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "assets", "assets-client.tsx"),
      `"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assetsDeleteAction, assetsSignReadAction, assetsSignUploadAction } from "@/lib/actions/assets.actions";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  objectKey: string;
  contentType?: string | null;
  createdAt?: string | Date;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/", "application/pdf", "text/"];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return "File too large. Maximum size is 10MB.";
  }
  const isAllowed = ALLOWED_TYPES.some(type => file.type.startsWith(type));
  if (!isAllowed) {
    return "File type not allowed. Allowed types: images, PDFs, text files.";
  }
  return null;
}

export function AssetsClient({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sorted = useMemo(
    () => [...assets].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
    [assets]
  );

  const handleUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setErr(validationError);
      return;
    }

    setErr(null);
    setUploadProgress(0);
    start(async () => {
      try {
        const signed = await assetsSignUploadAction({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        });

        // Upload with progress tracking
        const xhr = new XMLHttpRequest();
        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setUploadProgress((e.loaded / e.total) * 100);
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error("Upload failed"));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("PUT", signed.uploadUrl);
          xhr.setRequestHeader("Content-Type", signed.uploadHeaders?.["content-type"] || file.type || "application/octet-stream");
          xhr.send(file);
        });

        if (inputRef.current) inputRef.current.value = "";
        setUploadProgress(100);
        setTimeout(() => {
          setUploadProgress(0);
          router.refresh();
        }, 500);
      } catch (e: any) {
        setErr(String(e?.message ?? e));
        setUploadProgress(0);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag and Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted",
              busy && "opacity-50 pointer-events-none"
            )}
          >
            <div className="text-center">
              <p className="text-sm font-medium">Drop files here or click to select</p>
              <p className="text-xs text-muted-foreground mt-1">Max 10MB • Images, PDFs, Text files</p>
            </div>
          </div>

          {/* File Input */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input ref={inputRef} type="file" className="cursor-pointer sm:max-w-md" disabled={busy} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }} />
            <Button type="button" disabled={busy} onClick={() => {
              const f = inputRef.current?.files?.[0];
              if (f) handleUpload(f);
            }}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>

          {/* Progress Bar */}
          {uploadProgress > 0 && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{Math.round(uploadProgress)}%</p>
            </div>
          )}

          {/* Error Message */}
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Library</h2>
          <Badge variant="secondary">{sorted.length} assets</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              {/* Thumbnail for images */}
              {a.contentType?.startsWith("image/") && (
                <div className="aspect-video w-full bg-muted">
                  <img
                    src={'/api/v1/storage/sign-read?assetId=' + a.id}
                    alt={a.objectKey}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-mono break-all">{a.id}</CardTitle>
                  {a.contentType?.startsWith("image/") && (
                    <Badge variant="outline" className="text-xs">Image</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p>
                  <span className="text-muted-foreground">Type:</span> {a.contentType ?? "—"}
                </p>
                <p className="break-all">
                  <span className="text-muted-foreground">Key:</span> {a.objectKey}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="sm" disabled={busy}>
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone. The file will be permanently deleted from storage.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
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
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No assets yet. Upload your first file!</p>
          </div>
        )}
      </section>
    </div>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "assets", "[assetId]", "page.tsx"),
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
          <p><span className="text-muted-foreground">Provider:</span> {asset.provider}</p>
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
      path.join(ctx.projectRoot, "app", "app", "assets", "page.tsx"),
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
        <p className="text-sm text-muted-foreground">Org-scoped assets (active org cookie). Upload uses signed URLs to your configured provider.</p>
      </header>
      <AssetsClient assets={assets as any} />
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "hooks", "client", "use-assets.client.ts"),
      `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsKeys } from "@/lib/query-keys/assets.keys";

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
  const uploadHeaders = (json.uploadHeaders ?? {}) as Record<string, string>;
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      ...uploadHeaders,
      "content-type": file.type || "application/octet-stream",
    },
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

export function useAssetsList() {
  return useQuery({ queryKey: assetsKeys.mine(), queryFn: apiList });
}

export function useAssetsMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: assetsKeys.mine() });
  const upload = useMutation({ mutationFn: apiSignUpload, onSuccess: invalidate });
  const del = useMutation({ mutationFn: apiDelete, onSuccess: invalidate });
  const open = useMutation({
    mutationFn: apiSignRead,
    onSuccess: (x) => window.open(x.url, "_blank", "noopener,noreferrer"),
  });
  return { upload, del, open };
}
`
    );

    await ensureDir(path.join(ctx.projectRoot, "lib", "hooks", "client"));
  },
  validate: async () => { },
  sync: async () => { },
};
