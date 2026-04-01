export const orgsKeys = {
  all: ["orgs"] as const,
  mine: () => [...orgsKeys.all, "mine"] as const,
  active: () => [...orgsKeys.all, "active"] as const,
};
