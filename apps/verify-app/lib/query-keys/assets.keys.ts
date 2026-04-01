export const assetsKeys = {
  all: ["assets"] as const,
  mine: () => [...assetsKeys.all, "mine"] as const,
  org: (orgId: string) => [...assetsKeys.all, "org", orgId] as const,
};
