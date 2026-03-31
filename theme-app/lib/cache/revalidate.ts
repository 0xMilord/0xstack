import { revalidateTag } from "next/cache";
import { cacheTags } from "@/lib/cache/config";

export const revalidate = {
  tag: (tag: string) => revalidateTag(tag),
  project: (slug: string) => {
    revalidateTag(cacheTags.projects);
    revalidateTag(cacheTags.project(slug));
  },
  company: (slug: string) => {
    revalidateTag(cacheTags.companies);
    revalidateTag(cacheTags.company(slug));
  },
  posts: () => {
    revalidateTag(cacheTags.posts);
    revalidateTag(cacheTags.trending);
  },
  dashboard: (userId: string) => {
    revalidateTag(cacheTags.dashboard);
    revalidateTag(cacheTags.dashboardUser(userId));
  },
} as const;
