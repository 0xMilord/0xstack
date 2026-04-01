export const authKeys = {
  all: ["auth"] as const,
  viewer: () => [...authKeys.all, "viewer"] as const,
};
