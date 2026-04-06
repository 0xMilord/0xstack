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

  // Inject PWA meta tags: prefer inserting inside an existing <head>, fall back to creating one.
  if (!src.includes('rel="manifest"')) {
    const pwaTags = `\n        {/* 0xSTACK:PWA */}\n        <link rel="manifest" href="/manifest.webmanifest" />\n        <meta name="theme-color" content="#000000" />\n        <meta name="apple-mobile-web-app-capable" content="yes" />\n        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`;

    if (/<head[\s>]/i.test(src)) {
      // <head> exists — inject tags right after the opening <head> tag
      src = src.replace(/(<head[^>]*>)/i, `$1${pwaTags}`);
    } else {
      // No <head> — create one after <html>
      src = src.replace(
        /(<html[^>]*>)/i,
        `$1\n      <head>${pwaTags}\n      </head>`
      );
    }
  }

  // Wrap {children} with PwaProvider for PwaUpdateBanner to work across the app.
  // Only if not already wrapped.
  if (!src.includes("PwaProvider")) {
    // Add import
    src = src.replace(
      /(import\s+"\.\/*globals\.css";)/,
      `$1\nimport { PwaProvider } from "@/components/pwa/pwa-provider";`
    );
    // Wrap children - handle both `{children}` and `{ children }` patterns
    src = src.replace(
      /(<\/html[^>]*>)\s*\n(\s*)({children})/,
      `$1\n$2<PwaProvider>\n$2  $3\n$2</PwaProvider>`
    );
  }

  await fs.writeFile(layoutPath, src, "utf8");
}

export const pwaModule: Module = {
  id: "pwa",
  install: async () => { },
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
      await backupAndRemove(ctx.projectRoot, "lib/loaders/pwa.loader.ts");
      await backupAndRemove(ctx.projectRoot, "lib/actions/pwa.actions.ts");
      await backupAndRemove(ctx.projectRoot, "app/app/pwa/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/app/pwa/pwa-client.tsx");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "public"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "pwa"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "repos"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "services"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "actions"));
    await ensureDir(path.join(ctx.projectRoot, "app", "app", "pwa"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "subscribe"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "unsubscribe"));
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "send"));
    await ensureDir(path.join(ctx.projectRoot, "components", "pwa"));

    // PWA Provider component that wraps the app layout
    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "pwa", "pwa-provider.tsx"),
      `"use client";

import { useEffect, type ReactNode } from "react";
import { registerServiceWorker } from "@/lib/pwa/register-sw.client";
import { PwaUpdateBanner } from "@/components/pwa/pwa-update-banner";

/**
 * Registers the service worker on mount and renders the PWA update banner.
 * Place this in the root layout to activate PWA features site-wide.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  return (
    <>
      {children}
      <PwaUpdateBanner />
    </>
  );
}
`
    );

    // Patch site-header to include PWA install button
    const siteHeaderPath = path.join(ctx.projectRoot, "components", "site-header.tsx");
    let headerSrc = await fs.readFile(siteHeaderPath, "utf8").catch(() => "");
    if (headerSrc && !headerSrc.includes("PwaInstallButton")) {
      // Add import
      headerSrc = headerSrc.replace(
        /^(import\s+\{.+\}\s+from\s+["']@\/components\/ui\/button["'];)/m,
        `$1\nimport { PwaInstallButton } from "@/components/pwa/pwa-install-button";`
      );
      // Add PwaInstallButton near the end of the header content, before the closing </header>
      headerSrc = headerSrc.replace(
        /(<\/header>)/,
        `<PwaInstallButton variant="ghost" size="sm" className="ml-2" />\n$1`
      );
      await fs.writeFile(siteHeaderPath, headerSrc, "utf8");
    }

    await ensurePushTables(ctx.projectRoot);

    // TypeScript: `web-push` has no bundled typings; keep builds strict without requiring @types packages.
    await writeFileEnsured(
      path.join(ctx.projectRoot, "types", "web-push.d.ts"),
      `declare module "web-push";\n`
    );

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
      path.join(ctx.projectRoot, "lib", "loaders", "pwa.loader.ts"),
      `import { cache } from "react";
import { requireAuth } from "@/lib/auth/server";
import { env } from "@/lib/env/server";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";
import { pushSubscriptionsService_list } from "@/lib/services/push-subscriptions.service";

const loadPushSubsCached = withServerCache(
  async (userId: string) => await pushSubscriptionsService_list(userId),
  {
    key: (userId: string) => ["pwa", "push-subs", userId],
    tags: (userId: string) => [cacheTags.pushSubsUser(userId)],
    revalidate: CACHE_TTL.DASHBOARD,
  }
);

export const loadPwaSettings = cache(async () => {
  const viewer = await requireAuth();
  const subs = await loadPushSubsCached(viewer.userId);
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) throw new Error("missing_NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  return {
    viewer,
    vapidPublicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    subscriptions: subs,
  };
});
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "actions", "pwa.actions.ts"),
      `"use server";

import { requireAuth } from "@/lib/auth/server";
import { revalidate } from "@/lib/cache";
import { pushService_sendToUser } from "@/lib/services/push.service";
import { pushSubscriptionsService_unsubscribe } from "@/lib/services/push-subscriptions.service";

export async function pwaSendTestPushAction(input?: { title?: string; body?: string }) {
  const viewer = await requireAuth();
  const res = await pushService_sendToUser({
    userId: viewer.userId,
    payload: { title: input?.title ?? "Test push", body: input?.body, url: "/app/pwa", tag: "test-push" },
  });
  revalidate.pwaForUser(viewer.userId);
  return { ok: true as const, ...res };
}

export async function pwaUnsubscribeEndpointAction(input: { endpoint: string }) {
  const viewer = await requireAuth();
  await pushSubscriptionsService_unsubscribe(viewer.userId, input.endpoint);
  revalidate.pwaForUser(viewer.userId);
  return { ok: true as const };
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "pwa", "pwa-client.tsx"),
      `"use client";

import { useMemo, useState } from "react";
import { registerServiceWorker } from "@/lib/pwa/register-sw.client";
import { buttonVariants } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PwaClient({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const key = useMemo(() => urlBase64ToUint8Array(vapidPublicKey), [vapidPublicKey]);

  return (
    <div className="space-y-2">
      <button
        className={buttonVariants({ variant: "secondary" })}
        type="button"
        onClick={async () => {
          setStatus(null);
          await registerServiceWorker();
          const perm = await Notification.requestPermission();
          if (perm !== "granted") {
            setStatus("Notifications permission not granted.");
            return;
          }
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
          const res = await fetch("/api/v1/pwa/push/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(sub),
          });
          if (!res.ok) {
            setStatus("Subscribe failed.");
            return;
          }
          setStatus("Subscribed. Reload the page to see status.");
        }}
      >
        Enable notifications
      </button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "app", "pwa", "page.tsx"),
      `import { loadPwaSettings } from "@/lib/loaders/pwa.loader";
import { PwaClient } from "./pwa-client";
import { pwaSendTestPushAction, pwaUnsubscribeEndpointAction } from "@/lib/actions/pwa.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/**
 * Parse a push subscription endpoint URL into human-readable browser/platform info.
 */
function describeEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    if (u.hostname.includes("fcm.googleapis.com")) return "Chrome (FCM)";
    if (u.hostname.includes("push.services.mozilla.com")) return "Firefox";
    if (u.hostname.includes("web.push.apple.com")) return "Safari (Apple)";
    if (u.hostname.includes("notify.windows.com")) return "Edge (Windows)";
    if (u.hostname.includes("wns")) return "Windows (WNS)";
    return u.hostname;
  } catch {
    return endpoint;
  }
}

export default async function Page() {
  const { vapidPublicKey, subscriptions } = await loadPwaSettings();
  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">PWA</h1>
        <p className="text-sm text-muted-foreground">Manage push notifications for your account.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PwaClient vapidPublicKey={vapidPublicKey} />
          <form
            action={async () => {
              "use server";
              await pwaSendTestPushAction({ title: "Hello from 0xstack", body: "This is a test push." });
            }}
          >
            <button className={buttonVariants({ variant: "outline" })} type="submit">
              Send test push
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {subscriptions.length ? (
            subscriptions.map((s: any) => (
              <div key={s.endpoint} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{describeEndpoint(s.endpoint)}</p>
                  <p className="font-mono text-xs text-muted-foreground truncate">{s.endpoint}</p>
                </div>
                <form
                  action={async () => {
                    "use server";
                    await pwaUnsubscribeEndpointAction({ endpoint: String(s.endpoint) });
                  }}
                >
                  <button className={buttonVariants({ variant: "outline" })} type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No active subscriptions yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
`
    );

    // P0 #3: Conditionally import from SEO module for manifest
    const pwaSeoEnabled = ctx.modules.seo;
    const pwaManifestImport = pwaSeoEnabled
      ? `import { getSeoData } from "@/lib/seo/jsonld";`
      : `// SEO disabled — use env vars directly`;
    const pwaManifestData = pwaSeoEnabled
      ? `const seo = getSeoData();`
      : `const seo = { name: process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack", description: process.env.NEXT_PUBLIC_APP_DESC ?? "A modern SaaS stack" };`;

    // Dynamic manifest that reads from env vars
    await ensureDir(path.join(ctx.projectRoot, "app", "manifest"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "manifest", "route.ts"),
      `import { NextResponse } from "next/server";
${pwaManifestImport}

export async function GET() {
  ${pwaManifestData}
  const shortName = seo.name.substring(0, 12);
  
  return NextResponse.json({
    "$schema": "https://json.schemastore.org/web-manifest-combined.json",
    "id": "/?source=pwa",
    "name": seo.name,
    "short_name": shortName,
    "description": seo.description,
    "start_url": "/?source=pwa",
    "scope": "/",
    "display": "standalone",
    "display_override": ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
    "orientation": "any",
    "theme_color": "#000000",
    "background_color": "#ffffff",
    "categories": ["productivity", "business"],
    "lang": "en-US",
    "prefer_related_applications": false,
    "shortcuts": [
      {
        "name": "Settings",
        "short_name": "Settings",
        "description": "Open app settings",
        "url": "/app/settings",
        "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
      },
      {
        "name": "Dashboard",
        "short_name": "Dashboard",
        "description": "Open your dashboard",
        "url": "/app",
        "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
      }
    ],
    "icons": [
      { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
      { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
      { "src": "/icons/maskable-icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }, {
    headers: { "Content-Type": "application/manifest+json" }
  });
}
`
    );

    // Static fallback manifest (for older browsers)
    await writeFileEnsured(
      path.join(ctx.projectRoot, "public", "manifest.webmanifest"),
      `{
  "$schema": "https://json.schemastore.org/web-manifest-combined.json",
  "id": "/?source=pwa",
  "name": "0xstack App",
  "short_name": "0xstack",
  "description": "Production-ready Next.js starter.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
  "orientation": "any",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "categories": ["productivity", "business"],
  "lang": "en-US",
  "prefer_related_applications": false,
  "shortcuts": [
    {
      "name": "Settings",
      "short_name": "Settings",
      "description": "Open app settings",
      "url": "/app/settings",
      "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
    }
  ],
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
      `// SW_VERSION is baked at build time from git commit hash or timestamp.
// If NEXT_PUBLIC_GIT_HASH or BUILD_TIMESTAMP env vars are set, they take precedence.
const SW_VERSION = (() => {
  if (typeof process !== "undefined" && process.env) {
    return process.env.NEXT_PUBLIC_GIT_HASH || process.env.BUILD_TIMESTAMP || "dev";
  }
  return "client";
})();
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

// Handle SKIP_WAITING message from client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

import { useEffect, useState } from "react";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    
    // Listen for updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // New service worker available, user needs to refresh
          window.dispatchEvent(new CustomEvent("sw-update-available"));
        }
      });
    });
  } catch {
    // ignore
  }
}

/**
 * PWA status hook - tracks installability and update availability.
 * Use this to show custom install prompts and update notifications.
 */
export function usePwaStatus() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for SW updates
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener("sw-update-available", handleUpdate);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("sw-update-available", handleUpdate);
    };
  }, []);

  const canInstall = !!deferredPrompt && !isInstalled;

  const install = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return outcome === "accepted";
  };

  const refreshForUpdate = () => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  };

  return { canInstall, isInstalled, updateAvailable, install, refreshForUpdate };
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
      path.join(ctx.projectRoot, "components", "pwa", "pwa-update-banner.tsx"),
      `"use client";
\nimport { useEffect, useState } from "react";
import { usePwaStatus } from "@/lib/pwa/register-sw.client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
\n/**
 * Floating toast that appears when a new service worker version is detected.
 */
export function PwaUpdateBanner() {
  const { updateAvailable, refreshForUpdate } = usePwaStatus();
  const [show, setShow] = useState(false);
\n  useEffect(() => {
    if (updateAvailable) setShow(true);
  }, [updateAvailable]);
\n  if (!show) return null;
\n  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] sm:left-auto sm:right-4 sm:w-96">
      <Card className="shadow-2xl border-primary/50 bg-background/95 backdrop-blur">
        <CardContent className="flex items-center justify-between p-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
            </div>
            <div>
              <p className="text-sm font-semibold">Update available</p>
              <p className="text-xs text-muted-foreground">A new version is ready.</p>
            </div>
          </div>
          <Button size="sm" onClick={refreshForUpdate}>
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "components", "pwa", "pwa-install-button.tsx"),
      `"use client";
\nimport { usePwaStatus } from "@/lib/pwa/register-sw.client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Download } from "lucide-react";
\nexport function PwaInstallButton({ children, ...props }: ButtonProps) {
  const { canInstall, install } = usePwaStatus();
\n  if (!canInstall) return null;
\n  return (
    <Button variant="outline" size="sm" onClick={install} {...props}>
      <Download className="mr-2 h-4 w-4" />
      {children || "Install App"}
    </Button>
  );
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
  // Wrap DELETE+INSERT in a transaction for atomicity
  return await db.transaction(async (tx) => {
    await tx
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, sub.endpoint)));

    const rows = await tx
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
  });
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
      path.join(ctx.projectRoot, "lib", "services", "push-subscriptions.service.ts"),
      `import type { PushSubscriptionInput } from "@/lib/repos/push-subscriptions.repo";
import {
  upsertPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
} from "@/lib/repos/push-subscriptions.repo";

export async function pushSubscriptionsService_subscribe(userId: string, sub: PushSubscriptionInput) {
  return await upsertPushSubscription(userId, sub);
}

export async function pushSubscriptionsService_unsubscribe(userId: string, endpoint: string) {
  return await deletePushSubscription(userId, endpoint);
}

export async function pushSubscriptionsService_list(userId: string) {
  return await listPushSubscriptions(userId);
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "services", "push.service.ts"),
      `import webpush from "web-push";
import { configureWebPush } from "@/lib/pwa/push";
import { deletePushSubscription } from "@/lib/repos/push-subscriptions.repo";
import { pushSubscriptionsService_list } from "@/lib/services/push-subscriptions.service";

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
  const subs = await pushSubscriptionsService_list(input.userId);
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
import { pushSubscriptionsService_subscribe } from "@/lib/services/push-subscriptions.service";

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

  await pushSubscriptionsService_subscribe(session.user.id, body);
  return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } });
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "v1", "pwa", "push", "unsubscribe", "route.ts"),
      `import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/lib/auth/auth";
import { pushSubscriptionsService_unsubscribe } from "@/lib/services/push-subscriptions.service";

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

  await pushSubscriptionsService_unsubscribe(session.user.id, endpoint);
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
import { guardApiRequest, toApiErrorResponse } from "@/lib/security/api";

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }
  // Rate-limit this endpoint to prevent abuse
  try {
    await guardApiRequest(req, { max: 30, windowMs: 60_000 }, { requireApiKey: false });
  } catch (e: any) {
    return toApiErrorResponse(e);
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
  validate: async () => { },
  sync: async () => { },
};

