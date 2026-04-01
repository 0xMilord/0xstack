import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { z } from "zod";
import { withServerCache, CACHE_TTL, cacheTags } from "@/lib/cache";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  canonicalPath?: string;
  ogImage?: string;
  tags?: string[];
  content: string;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

const FrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().min(1),
  published: z.boolean().optional().default(true),
  canonicalPath: z.string().min(1).optional(),
  ogImage: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

function parsePost(slug: string, raw: string): BlogPost {
  const parsed = matter(raw);
  const fm = FrontmatterSchema.safeParse(parsed.data ?? {});
  if (!fm.success) {
    const msg = fm.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ");
    throw new Error(`invalid_frontmatter:${slug}: ${msg}`);
  }
  const d = new Date(fm.data.date);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid_date:${slug}`);
  return {
    slug,
    title: fm.data.title,
    description: fm.data.description,
    date: fm.data.date,
    published: fm.data.published !== false,
    canonicalPath: fm.data.canonicalPath,
    ogImage: fm.data.ogImage,
    tags: fm.data.tags,
    content: parsed.content,
  };
}

const listPostsCached = withServerCache(
  async () => {
    const entries = await fs.readdir(BLOG_DIR);
    const posts: BlogPost[] = [];
    for (const file of entries) {
      if (!file.endsWith(".mdx")) continue;
      const slug = file.replace(/\.mdx$/, "");
      const raw = await fs.readFile(path.join(BLOG_DIR, file), "utf8");
      posts.push(parsePost(slug, raw));
    }
    return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  {
    key: () => ["blog", "posts"],
    tags: () => [cacheTags.posts],
    revalidate: CACHE_TTL.LISTING,
  }
);

export const listPosts = cache(async (): Promise<BlogPost[]> => {
  return await listPostsCached();
});

const getPostCached = withServerCache(
  async (slug: string) => {
    const raw = await fs.readFile(path.join(BLOG_DIR, `${slug}.mdx`), "utf8");
    return parsePost(slug, raw);
  },
  {
    key: (slug: string) => ["blog", "post", slug],
    tags: () => [cacheTags.posts],
    revalidate: CACHE_TTL.ENTITY_PAGE,
  }
);

export const getPost = cache(async (slug: string) => {
  return await getPostCached(slug);
});

export function getPostCanonicalUrl(input: { baseUrl: string; slug: string; canonicalPath?: string }) {
  const p = input.canonicalPath?.startsWith("/") ? input.canonicalPath : `/blog/${input.slug}`;
  return new URL(p, input.baseUrl).toString();
}
