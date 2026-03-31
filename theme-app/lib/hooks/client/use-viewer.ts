"use client";

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
