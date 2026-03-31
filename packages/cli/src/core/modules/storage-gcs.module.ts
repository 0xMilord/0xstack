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
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "storage"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "query-keys"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "mutation-keys"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-read"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]"));
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
  return new Storage({ projectId: env.GCS_PROJECT_ID });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "storage.service.ts"),
      `import crypto from "node:crypto";
import { env } from "@/lib/env/server";
import { getGcs } from "@/lib/storage/gcs";
import { insertAsset, deleteAssetById, listAssetsForOrg, listAssetsForUser } from "@/lib/repos/assets.repo";
import { assets } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function storageService_createSignedUpload(input: {
  contentType: string;
  objectKey: string;
  ownerUserId: string | null;
  orgId: string | null;
}) {
  const bucket = getGcs().bucket(env.GCS_BUCKET);
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
    ownerUserId: input.ownerUserId,
    orgId: input.orgId,
    bucket: env.GCS_BUCKET,
    objectKey: input.objectKey,
    contentType: input.contentType,
  });

  return { assetId, bucket: env.GCS_BUCKET, objectKey: input.objectKey, uploadUrl, expiresInSeconds: 900 };
}

export async function storageService_createSignedRead(input: { assetId: string }) {
  const rows = await db.select().from(assets).where(eq(assets.id, input.assetId)).limit(1);
  const a = rows[0];
  if (!a) throw new Error("Asset not found");
  const bucket = getGcs().bucket(a.bucket);
  const file = bucket.file(a.objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 10 * 60 * 1000,
  });
  return { url, expiresInSeconds: 600, asset: a };
}

export async function storageService_deleteAsset(input: { assetId: string }) {
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
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "sign-upload", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_createSignedUpload } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
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
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";
import { storageService_createSignedRead } from "@/lib/services/storage.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    await guardApiRequest(req);
    const body = (await req.json().catch(() => null)) as null | { assetId?: string };
    const assetId = body?.assetId;
    if (!assetId) {
      return NextResponse.json({ ok: false, requestId, code: "INVALID_INPUT", message: "assetId is required" }, { status: 400 });
    }
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
import { auth } from "@/lib/auth/auth";
import { storageService_listAssets } from "@/lib/services/storage.service";

export async function GET(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const assets = await storageService_listAssets({ ownerUserId: session.user.id, orgId: null });
  return NextResponse.json({ ok: true, requestId, assets });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "storage", "assets", "[assetId]", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { storageService_deleteAsset } from "@/lib/services/storage.service";

export async function DELETE(req: Request, ctx: { params: Promise<{ assetId: string }> }) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ ok: false, requestId, error: "unauthorized" }, { status: 401 });
  const { assetId } = await ctx.params;
  const res = await storageService_deleteAsset({ assetId });
  return NextResponse.json({ ok: true, requestId, ...res });
}
`
    );

    // Plug-and-play UI: /app/app/assets
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "assets"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "assets", "page.tsx"),
      `"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assetsKeys } from "@/lib/query-keys/assets.keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Asset = {
  id: string;
  bucket: string;
  objectKey: string;
  contentType?: string | null;
  createdAt?: string | Date;
};

async function apiList(): Promise<Asset[]> {
  const res = await fetch("/api/v1/storage/assets");
  if (!res.ok) throw new Error("Failed to load assets");
  const json = await res.json();
  return json.assets ?? [];
}

async function apiSignRead(assetId: string): Promise<{ url: string }> {
  const res = await fetch("/api/v1/storage/sign-read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId }),
  });
  if (!res.ok) throw new Error("Failed to sign read URL");
  const json = await res.json();
  return { url: json.url };
}

async function apiDelete(assetId: string) {
  const res = await fetch("/api/v1/storage/assets/" + encodeURIComponent(assetId), { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete asset");
}

export default function Page() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: assetsKeys.mine(), queryFn: apiList });
  const assets = data ?? [];

  const [assetId, setAssetId] = useState("");

  const del = useMutation({
    mutationFn: apiDelete,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assetsKeys.mine() });
    },
  });

  const open = useMutation({
    mutationFn: apiSignRead,
    onSuccess: (x) => {
      window.open(x.url, "_blank", "noopener,noreferrer");
    },
  });

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">List, open (signed read), and delete uploaded assets.</p>
      </header>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">Asset ID</label>
            <Input value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="paste asset id…" />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!assetId || open.isPending}
              onClick={() => open.mutate(assetId)}
            >
              Open
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!assetId || del.isPending}
              onClick={() => del.mutate(assetId)}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Your assets</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{String(error)}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {assets.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-sm">{a.id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
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

