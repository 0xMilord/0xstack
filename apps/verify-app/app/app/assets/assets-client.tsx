"use client";

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
                    headers: signed.uploadHeaders ?? { "content-type": f.type || "application/octet-stream" },
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
