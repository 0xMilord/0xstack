import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/loaders/blog.loader";
import { env } from "@/lib/env/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const base: MetadataRoute.Sitemap = [
    { url: new URL("/", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/about", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/contact", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/pricing", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/terms", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/privacy", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/login", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/get-started", baseUrl).toString(), lastModified: new Date() },
  ];

  // Optional blog
  try {
    const posts = await listPosts();
    for (const p of posts) {
      if (!p.published) continue;
      base.push({ url: new URL(`/blog/${p.slug}`, baseUrl).toString(), lastModified: new Date(p.date || Date.now()) });
    }
    base.push({ url: new URL("/blog", baseUrl).toString(), lastModified: new Date() });
  } catch {
    // blog disabled or loader missing
  }

  return base;
}
