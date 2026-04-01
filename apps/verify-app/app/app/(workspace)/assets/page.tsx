"use client";

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
