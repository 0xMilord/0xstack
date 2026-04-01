export const billingKeys = {
  all: ["billing"] as const,
  org: (orgId: string) => [...billingKeys.all, "org", orgId] as const,
};
