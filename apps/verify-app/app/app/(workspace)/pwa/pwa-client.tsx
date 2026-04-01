"use client";

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
