import { revalidateTag } from "next/cache";
import { cacheTags } from "@/lib/cache/config";

export const revalidate = {
  tag: (tag: string) => revalidateTag(tag, "page"),
  project: (slug: string) => {
    revalidateTag(cacheTags.projects, "page");
    revalidateTag(cacheTags.project(slug), "page");
  },
  company: (slug: string) => {
    revalidateTag(cacheTags.companies, "page");
    revalidateTag(cacheTags.company(slug), "page");
  },
  posts: () => {
    revalidateTag(cacheTags.posts, "page");
    revalidateTag(cacheTags.trending, "page");
  },
  dashboard: (userId: string) => {
    revalidateTag(cacheTags.dashboard, "page");
    revalidateTag(cacheTags.dashboardUser(userId), "page");
  },
  orgs: (userId: string) => {
    revalidateTag(cacheTags.orgsForUser(userId), "page");
    revalidateTag(cacheTags.dashboard, "page");
  },
  billingForOrg: (orgId: string) => {
    revalidateTag(cacheTags.billingOrg(orgId), "page");
  },
  assetsForOrg: (orgId: string) => {
    revalidateTag(cacheTags.assetsOrg(orgId), "page");
  },
  pwaForUser: (userId: string) => {
    revalidateTag(cacheTags.pushSubsUser(userId), "page");
  },
  webhookLedger: () => {
    revalidateTag(cacheTags.webhookLedger, "page");
  },
} as const;
