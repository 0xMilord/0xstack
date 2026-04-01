import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
