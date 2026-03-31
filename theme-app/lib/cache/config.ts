export const CACHE_TTL = {
  ENTITY_PAGE: 60 * 60 * 24, // 24h
  IDENTITY: 60 * 60, // 1h
  LISTING: 60 * 60, // 1h
  DASHBOARD: 60 * 10, // 10m
} as const;

export const cacheTags = {
  // collections
  projects: "projects",
  companies: "companies",
  jobs: "jobs",
  posts: "posts",
  trending: "trending",
  dashboard: "dashboard",
  viewer: "viewer",

  // entity helpers
  project: (slug: string) => `project-slug:${slug}`,
  company: (slug: string) => `company:${slug}`,
  user: (username: string) => `user:${username}`,
  dashboardUser: (userId: string) => `dashboard:${userId}`,
  viewerUser: (userId: string) => `viewer:${userId}`,
} as const;
