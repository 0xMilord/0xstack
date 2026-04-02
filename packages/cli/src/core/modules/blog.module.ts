import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const blogMdxModule: Module = {
  id: "blogMdx",
  install: async () => { },
  activate: async (ctx) => {
    if (!ctx.modules.blogMdx) {
      await backupAndRemove(ctx.projectRoot, "app/blog/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/blog/[slug]/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/blog/[slug]/opengraph-image/route.ts");
      await backupAndRemove(ctx.projectRoot, "app/blog/[slug]/opengraph-image/route.tsx");
      await backupAndRemove(ctx.projectRoot, "app/rss.xml/route.ts");
      await backupAndRemove(ctx.projectRoot, "lib/loaders/blog.loader.ts");
      await backupAndRemove(ctx.projectRoot, "content/blog/hello-world.mdx");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "content", "blog"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "what-is-0xstack.mdx"),
      `---
title: "What is 0xstack?"
description: "A deep dive into the production-ready Next.js architecture built for vibecoders."
date: "2026-04-02"
published: true
---

# Welcome to 0xstack

0xstack is a production-ready Next.js framework designed for the modern web. It provides a solid foundation with **Next.js App Router**, **Better Auth**, and **Drizzle ORM**—all wired together to save you weeks of configuration.

## Why 0xstack?

We wanted a stack that gets out of the way so we can focus on building features. With CQRS patterns, unified configuration, and built-in CLI doctors, 0xstack ensures your project stays healthy as it scales.

- **Flat Architecture**: No deep nesting. Repositories, Services, and Loaders live clearly in \`lib/\`.
- **Integrated Auth & Billing**: Hooks into Better Auth and Dodo Payments out of the box.
- **Built for AI Development**: We call it *vibecoding mentor*. Clear boundaries make it perfectly suited for AI code generation contexts.
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "how-0xstack-works.mdx"),
      `---
title: "How 0xstack Works: The Architecture Layer"
description: "Understanding the CQRS pattern and boundaries inside the 0xstack framework."
date: "2026-04-01"
published: true
---

# Architecture in 0xstack

The core philosophy of 0xstack is strict boundary enforcement. Let's look at the layers:

## 1. Repositories (\`lib/repos/\`)
The only layer allowed to talk to Drizzle ORM directly. No HTTP, no business logic.

## 2. Services (\`lib/services/\`)
The business logic layer. Services coordinate repository calls, apply permissions, and trigger webhooks.

## 3. Loaders & Actions (\`lib/loaders/\`, \`lib/actions/\`)
The boundary between Server Components and your underlying data. Loaders read (cached), Actions mutate.

## 4. The Presentation Layer
Server Components and Client Components in the \`app/\` directory safely consume loaders and actions.

By keeping these layers distinct, your application is inherently easier to test, secure, and refactor.
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "vibecoding-with-0xstack.mdx"),
      `---
title: "Vibecoding with 0xstack"
description: "How to leverage AI coding assistants within the structured boundaries of 0xstack."
date: "2026-03-31"
published: true
---

# The Era of Vibecoding

*Vibecoding* is the act of scaffolding, writing, and refactoring code fluidly with an AI companion. 

## The Problem with AI Code
AI is amazing at writing isolated functions, but terrible at architecting complex, interconnected systems over time. When using raw Next.js, an AI will quickly create a tangled mess of server components talking directly to databases.

## The 0xstack Solution
0xstack provides the rigid scaffolding that AI needs. Because the architecture (Repos -> Services -> Actions) is strictly defined and checked by the \`0xstack doctor\`, you can safely ask an AI to "create a new feature" and know exactly where its generated code should live.

1. Tell the AI to generate a Drizzle schema.
2. Ask it to write a Repository to query that schema.
3. Hook it up to a UI.

It's that simple. Happy vibecoding!
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "blog.loader.ts"),
      `import fs from "node:fs/promises";
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
    throw new Error(\`invalid_frontmatter:\${slug}: \${msg}\`);
  }
  const d = new Date(fm.data.date);
  if (Number.isNaN(d.getTime())) throw new Error(\`invalid_date:\${slug}\`);
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
      const slug = file.replace(/\\.mdx$/, "");
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
    const raw = await fs.readFile(path.join(BLOG_DIR, \`\${slug}.mdx\`), "utf8");
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
  const p = input.canonicalPath?.startsWith("/") ? input.canonicalPath : \`/blog/\${input.slug}\`;
  return new URL(p, input.baseUrl).toString();
}
`
    );

    await ensureDir(path.join(ctx.projectRoot, "app", "blog", "[slug]"));
    await ensureDir(path.join(ctx.projectRoot, "app", "blog", "[slug]", "opengraph-image"));
    await backupAndRemove(ctx.projectRoot, "app/blog/[slug]/opengraph-image/route.ts");
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "blog", "page.tsx"),
      `import Link from "next/link";
import { listPosts } from "@/lib/loaders/blog.loader";

export default async function Page() {
  const posts = await listPosts();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Blog</h1>
      <div className="mt-6 space-y-4">
        {posts.map((p) => (
          <div key={p.slug} className="rounded-lg border p-4">
            <Link className="text-lg font-medium underline" href={\`/blog/\${p.slug}\`}>
              {p.title}
            </Link>
            <p className="text-sm text-muted-foreground">{p.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "blog", "[slug]", "page.tsx"),
      `import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { env } from "@/lib/env/server";
import { getPost, getPostCanonicalUrl } from "@/lib/loaders/blog.loader";
import { safeJsonLd } from "@/lib/seo/jsonld";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post || !post.published) return {};
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const canonical = getPostCanonicalUrl({ baseUrl, slug: post.slug, canonicalPath: post.canonicalPath });
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.description,
      images: [{ url: \`/blog/\${post.slug}/opengraph-image\` }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [\`/blog/\${post.slug}/opengraph-image\`],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post || !post.published) return notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{post.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{post.date}</p>
      <article className="prose prose-neutral dark:prose-invert mt-8">
        <MDXRemote source={post.content} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            mainEntityOfPage: { "@type": "WebPage", "@id": \`/blog/\${post.slug}\` },
          }),
        }}
      />
    </main>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "blog", "[slug]", "opengraph-image", "route.tsx"),
      `import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getPost } from "@/lib/loaders/blog.loader";

export const runtime = "edge";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const post = await getPost(slug);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 64, background: "#0a0a0a", color: "#ffffff" }}>
        <div style={{ fontSize: 28, color: "#d4d4d4" }}>{process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"}</div>
        <div style={{ marginTop: 16, fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>{post.title}</div>
        <div style={{ marginTop: 16, fontSize: 24, color: "#a3a3a3" }}>{post.description}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
`
    );

    await ensureDir(path.join(ctx.projectRoot, "app", "rss.xml"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "rss.xml", "route.ts"),
      `import { NextResponse } from "next/server";
import { listPosts } from "@/lib/loaders/blog.loader";
import { env } from "@/lib/env/server";

export async function GET() {
  const posts = await listPosts();
  const items = posts
    .map(
      (p) => \`<item><title>\${escapeXml(p.title)}</title><link>\${env.NEXT_PUBLIC_APP_URL}/blog/\${p.slug}</link><description>\${escapeXml(p.description)}</description></item>\`
    )
    .join("");
  const xml = \`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog</title><link>\${env.NEXT_PUBLIC_APP_URL}</link>\${items}</channel></rss>\`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
`
    );
  },
  validate: async () => { },
  sync: async () => { },
};

