import path from "node:path";
import fs from "node:fs/promises";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";
import { ensurePushTables } from "../generate/schema-edit";

async function patchRootLayoutForPwa(projectRoot: string) {
  const layoutPath = path.join(projectRoot, "app", "layout.tsx");
  let src = await fs.readFile(layoutPath, "utf8");
  if (src.includes("0xSTACK:PWA")) return;

  // Add minimal meta tags + manifest link. This is additive and safe.
  src = src.replace(
    /import\s+"\.\/*globals\.css";\s*\n/m,
    (m) =>
      `${m}\n// 0xSTACK:PWA\n// NOTE: keep these tags for installability + iOS.\n`
  );

  // Try to inject into <head> via metadata is better, but we keep a small patch for compatibility.
  // If layout already uses metadata export, the manifest is still discovered from /public and link tags help iOS.
  if (!src.includes('rel="manifest"')) {
    src = src.replace(
      /<html([^>]*)>\s*/m,
      (m) =>
        `${m}<head>\n        {/* 0xSTACK:PWA */}\n        <link rel="manifest" href="/manifest.webmanifest" />\n        <meta name="theme-color" content="#000000" />\n        <meta name="apple-mobile-web-app-capable" content="yes" />\n        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n      </head>\n`
    );
  }

  await fs.writeFile(layoutPath, src, "utf8");
}

export const pwaModule: Module = {
  id: "pwa",
  install: async () => {},
  activate: async (ctx) => {
    if (!ctx.modules.pwa) {
      await backupAndRemove(ctx.projectRoot, "public/manifest.webmanifest");
      await backupAndRemove(ctx.projectRoot, "public/sw.js");
      await backupAndRemove(ctx.projectRoot, "public/offline.html");
      await backupAndRemove(ctx.projectRoot, "lib/pwa/push.ts");
      await backupAndRemove(ctx.projectRoot, "lib/pwa/offline-storage.ts");
      await backupAndRemove(ctx.projectRoot, "lib/pwa/register-sw.client.ts");
      await backupAndRemove(ctx.projectRoot, "app/api/v1/pwa/push/subscribe/route.ts");
      await backupAndRemove(ctx.projectRoot, "app/api/v1/pwa/push/unsubscribe/route.ts");
      await backupAndRemove(ctx.projectRoot, "app/api/v1/pwa/push/send/route.ts");
      await backupAndRemove(ctx.projectRoot, "lib/env/pwa.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "public"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "pwa"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "subscribe"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "unsubscribe"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "send"));

    await ensurePushTables(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "pwa.ts"),
      `import { z } from "zod";
\nexport const PwaEnvSchema = z.object({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "public", "manifest.webmanifest"),
      `{
  "$schema": "https://json.schemastore.org/web-manifest-combined.json",
  "id": "/?source=pwa",
  "name": "${ctx.profile === "full" ? "0xstack" : "0xstack"}",
  "short_name": "0xstack",
  "description": "Production-grade Next.js starter.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
  "orientation": "any",
  "theme_color": "#000000",
  "background_color": "#000000",
  "categories": ["productivity", "business"],
  "lang": "en-US",
  "prefer_related_applications": false,
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "public", "offline.html"),
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You're Offline</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        background: #0a0a0a;
        color: #fff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        max-width: 520px;
        padding: 24px;
        border: 1px solid #262626;
        border-radius: 14px;
        background: #0f0f0f;
      }
      h1 { margin: 0 0 8px; font-size: 18px; }
      p { margin: 0 0 16px; color: #a3a3a3; }
      button {
        background: #fff;
        color: #000;
        border: 0;
        padding: 10px 14px;
        border-radius: 10px;
        font-weight: 600;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You're offline</h1>
      <p>Some features may be limited until you're back online.</p>
      <button onclick="location.reload()">Try again</button>
    </div>
  </body>
</html>
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "public", "sw.js"),
      `const SW_VERSION = "1.0.0";
const CACHE_NAME = \`0xstack-v\${SW_VERSION}\`;
const PRECACHE_ASSETS = ["/", "/manifest.webmanifest", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : Promise.resolve())))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isAsset = /\\.(png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2)$/i.test(url.pathname);

  if (isAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fetchPromise = fetch(req).then((res) => {
            cache.put(req, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // navigation/html: network-first with offline fallback
  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Notification", {
      body: data.body ?? "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: data.data ?? {},
      actions: data.actions ?? [],
      tag: data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url ?? "/";
  event.waitUntil(self.clients.openWindow(url));
});
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "pwa", "register-sw.client.ts"),
      `"use client";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    // ignore
  }
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "pwa", "offline-storage.ts"),
      `import { openDB } from "idb";

const DB_NAME = "0xstack-offline";
const DB_VERSION = 1;

type OfflineDB = {
  "pending-requests": { key: string; value: { id: string; bodyJson: any; createdAt: number } };
};

let dbPromise: ReturnType<typeof openDB<OfflineDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("pending-requests", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function savePendingRequest(bodyJson: any) {
  const db = await getDb();
  await db.put("pending-requests", { id: crypto.randomUUID(), bodyJson, createdAt: Date.now() });
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "pwa", "push.ts"),
      `import webpush from "web-push";
import { env } from "@/lib/env/server";

export function configureWebPush() {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "repos", "push-subscriptions.repo.ts"),
      `import crypto from "node:crypto";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function upsertPushSubscription(userId: string, sub: PushSubscriptionInput) {
  // Drizzle doesn't have cross-db upsert helpers consistently; do a simple best-effort:
  // delete then insert (unique on user+endpoint).
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, sub.endpoint)));

  const rows = await db
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .returning();
  return rows[0] ?? null;
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function listPushSubscriptions(userId: string) {
  return await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).limit(50);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "push.service.ts"),
      `import webpush from "web-push";
import { configureWebPush } from "@/lib/pwa/push";
import { deletePushSubscription, listPushSubscriptions } from "@/lib/repos/push-subscriptions.repo";

export async function pushService_sendToUser(input: {
  userId: string;
  payload: {
    title: string;
    body?: string;
    url?: string;
    tag?: string;
    actions?: Array<{ action: string; title: string; icon?: string }>;
  };
}) {
  configureWebPush();
  const subs = await listPushSubscriptions(input.userId);
  const json = JSON.stringify({
    title: input.payload.title,
    body: input.payload.body,
    tag: input.payload.tag,
    actions: input.payload.actions ?? [],
    data: { url: input.payload.url ?? "/" },
  });

  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
          json,
          { TTL: 86400 }
        );
        return { ok: true as const };
      } catch (e: any) {
        if (e?.statusCode === 410) {
          await deletePushSubscription(input.userId, s.endpoint);
        }
        throw e;
      }
    })
  );

  return {
    attempted: subs.length,
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "subscribe", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { upsertPushSubscription } from "@/lib/repos/push-subscriptions.repo";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }

  const body = await req.json();
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ ok: false, error: "invalid_subscription", requestId }, { status: 400 });
  }

  await upsertPushSubscription(session.user.id, body);
  return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "unsubscribe", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { deletePushSubscription } from "@/lib/repos/push-subscriptions.repo";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }

  // Accept either { endpoint } or full subscription JSON.
  const body = await req.json().catch(() => ({} as any));
  const endpoint = body?.endpoint ?? body?.subscription?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return NextResponse.json({ ok: false, error: "invalid_endpoint", requestId }, { status: 400 });
  }

  await deletePushSubscription(session.user.id, endpoint);
  return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "send", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { pushService_sendToUser } from "@/lib/services/push.service";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : "Notification";
  const res = await pushService_sendToUser({
    userId: session.user.id,
    payload: {
      title,
      body: typeof body?.body === "string" ? body.body : undefined,
      url: typeof body?.url === "string" ? body.url : "/",
      tag: typeof body?.tag === "string" ? body.tag : undefined,
      actions: Array.isArray(body?.actions) ? body.actions : undefined,
    },
  });
  return NextResponse.json({ ok: true, requestId, ...res }, { headers: { "x-request-id": requestId } });
}
`
    );

    await patchRootLayoutForPwa(ctx.projectRoot);
  },
  validate: async () => {},
  sync: async () => {},
};

