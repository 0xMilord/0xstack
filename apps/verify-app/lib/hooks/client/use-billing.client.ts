import { useQueryClient } from "@tanstack/react-query";
import { billingKeys } from "@/lib/query-keys/billing.keys";

export { billingKeys };

/** Invalidate billing queries after client-side flows; prefer RSC loaders for reads. */
export function useInvalidateBilling() {
  const qc = useQueryClient();
  return (orgId: string) => qc.invalidateQueries({ queryKey: billingKeys.org(orgId) });
}
