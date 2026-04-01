export const apiKeysKeys = {
  all: ["api-keys"] as const,
  org: (orgId: string) => [...apiKeysKeys.all, "org", orgId] as const,
};
