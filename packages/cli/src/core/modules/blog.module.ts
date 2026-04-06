import fs from "node:fs/promises";
import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

async function ensureTypographyPlugin(projectRoot: string) {
  const p = path.join(projectRoot, "app", "globals.css");
  let s = await fs.readFile(p, "utf8").catch(() => "");
  if (!s) return;
  if (s.includes('@plugin "@tailwindcss/typography"') || s.includes("@plugin '@tailwindcss/typography'")) return;
  if (!s.includes('@import "tailwindcss"')) return;
  s = s.replace(/^@import "tailwindcss";\n/m, `@import "tailwindcss";\n@plugin "@tailwindcss/typography";\n`);
  await fs.writeFile(p, s, "utf8");
}

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

    await ensureTypographyPlugin(ctx.projectRoot);

    await ensureDir(path.join(ctx.projectRoot, "content", "blog"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "what-is-0xstack.mdx"),
      `---
title: "What is 0xstack?"
description: "A deep dive into the production-ready Next.js architecture built for vibecoders."
date: "2026-04-02"
published: true
tags: ["featured", "architecture", "introduction"]
---

# Welcome to 0xstack

0xstack is a **production-ready Next.js framework** designed for the modern web. It provides a solid foundation with **Next.js App Router**, **Better Auth**, and **Drizzle ORM**—all wired together to save you weeks of configuration.

## Why 0xstack?

We wanted a stack that gets out of the way so we can focus on building features. With CQRS patterns, unified configuration, and built-in CLI doctors, 0xstack ensures your project stays healthy as it scales.

### Key Features

- **Flat Architecture**: No deep nesting. Repositories, Services, and Loaders live clearly in \`lib/\`.
- **Integrated Auth & Billing**: Hooks into Better Auth and Dodo Payments out of the box.
- **Built for AI Development**: We call it *vibecoding mentor*. Clear boundaries make it perfectly suited for AI code generation contexts.
- **Self-Healing CLI**: Run \`npx 0xstack doctor\` to detect architecture drift before it becomes technical debt.

## Quick Start

\`\`\`bash
# Create a new project
npx 0xstack init

# Install baseline
npx 0xstack baseline --profile core

# Start developing
pnpm dev
\`\`\`

## The Philosophy

0xstack enforces **two highways**:

1. **Read Highway (Fast)**: RSC → Loader → Repo → DB
2. **Write Highway (Safe)**: Client UI → Action → Rules → Service → Repo → DB

This separation ensures your reads are cached and fast, while your writes are validated and secure.

---

**Ready to build?** [Get started with 0xstack](/get-started)
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "how-0xstack-works.mdx"),
      `---
title: "How 0xstack Works: The Architecture Layer"
description: "Understanding the CQRS pattern and boundaries inside the 0xstack framework."
date: "2026-04-01"
published: true
tags: ["architecture", "cqrs", "tutorial"]
---

# Architecture in 0xstack

The core philosophy of 0xstack is **strict boundary enforcement**. Let's look at the layers:

## 1. Repositories (\`lib/repos/\`)

The only layer allowed to talk to Drizzle ORM directly. No HTTP, no business logic.

\`\`\`typescript
// lib/repos/posts.repo.ts
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

export async function listPosts() {
  return await db.select().from(posts);
}
\`\`\`

## 2. Services (\`lib/services/\`)

The business logic layer. Services coordinate repository calls, apply permissions, and trigger webhooks.

\`\`\`typescript
// lib/services/posts.service.ts
import { listPosts } from "@/lib/repos/posts.repo";
import { requireAuth } from "@/lib/auth/server";

export async function listPostsForUser(userId: string) {
  const viewer = await requireAuth();
  // Apply business logic here
  return await listPosts();
}
\`\`\`

## 3. Loaders & Actions (\`lib/loaders/\`, \`lib/actions/\`)

The boundary between Server Components and your underlying data.

- **Loaders** read (cached with React.cache)
- **Actions** mutate (with revalidation)

\`\`\`typescript
// lib/loaders/posts.loader.ts
import { cache } from "react";
import { listPosts } from "@/lib/services/posts.service";

export const loadPosts = cache(async () => {
  return await listPosts();
});
\`\`\`

## 4. The Presentation Layer

Server Components and Client Components in the \`app/\` directory safely consume loaders and actions.

\`\`\`tsx
// app/posts/page.tsx
import { loadPosts } from "@/lib/loaders/posts.loader";

export default async function Page() {
  const posts = await loadPosts();
  return <div>{/* render posts */}</div>;
}
\`\`\`

## Boundary Enforcement

The \`0xstack doctor\` command scans your codebase for violations:

- ❌ UI importing repos directly
- ❌ Loaders importing actions
- ❌ Services importing loaders

By keeping these layers distinct, your application is inherently easier to test, secure, and refactor.

---

**Want to see it in action?** [Check out the vibecoding guide](/blog/vibecoding-with-0xstack)
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "vibecoding-with-0xstack.mdx"),
      `---
title: "Vibecoding with 0xstack"
description: "How to leverage AI coding assistants within the structured boundaries of 0xstack."
date: "2026-03-31"
published: true
tags: ["ai", "productivity", "vibecoding"]
---

# The Era of Vibecoding

*Vibecoding* is the act of scaffolding, writing, and refactoring code fluidly with an AI companion.

## The Problem with AI Code

AI is amazing at writing isolated functions, but terrible at architecting complex, interconnected systems over time. When using raw Next.js, an AI will quickly create a tangled mess of server components talking directly to databases.

## The 0xstack Solution

0xstack provides the **rigid scaffolding** that AI needs. Because the architecture (Repos → Services → Actions) is strictly defined and checked by the \`0xstack doctor\`, you can safely ask an AI to "create a new feature" and know exactly where its generated code should live.

## The Vibecoding Workflow

### 1. Schema First

Tell the AI to generate a Drizzle schema:

\`\`\`
Create a Drizzle schema for a blog post with title, content, published status, and author
\`\`\`

### 2. Repository Layer

Ask it to write a Repository to query that schema:

\`\`\`
Create a repository function to list all published posts ordered by date
\`\`\`

### 3. Service Layer

Hook up business logic:

\`\`\`
Create a service that lists posts but only shows drafts to the author
\`\`\`

### 4. UI Layer

Finally, generate the UI:

\`\`\`
Create a blog index page that displays posts in a grid with cards
\`\`\`

## Why This Works

| Without 0xstack | With 0xstack |
|-----------------|--------------|
| AI puts DB calls in components | AI follows repo → service → action pattern |
| No caching strategy | Loaders are automatically cached |
| Mixed read/write logic | CQRS enforced by architecture |
| Hard to test | Each layer is independently testable |

## The Doctor Keeps You Honest

Run \`npx 0xstack doctor\` after AI generates code:

\`\`\`bash
$ npx 0xstack doctor

┌──────────────────────────────────────────┐
│  🔍 0xstack Doctor — Project Health       │
└──────────────────────────────────────────┘

Health Score: 95/100
✓ All checks passed
\`\`\`

If the AI messed up and imported a repo directly into a component, the doctor will catch it.

---

**Ready to start vibecoding?** [Initialize your 0xstack project](/get-started)
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function Page() {
  const posts = await listPosts();
  const featured = posts.find(p => p.tags?.includes("featured")) || posts[0];
  const regular = posts.filter(p => p !== featured);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Insights on building with 0xstack — architecture, best practices, and vibecoding.
        </p>
      </header>

      {featured && (
        <section className="mb-12">
          <Link href={\`/blog/\${featured.slug}\`} className="group">
            <Card className="overflow-hidden border-2">
              <div className="aspect-video w-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Featured</Badge>
                  {featured.tags?.slice(0, 2).map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
                <CardTitle className="text-2xl group-hover:underline">{featured.title}</CardTitle>
                <CardDescription className="text-base">{featured.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <time className="text-sm text-muted-foreground">{formatDate(featured.date)}</time>
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {regular.map((post) => (
          <Link key={post.slug} href={\`/blog/\${post.slug}\`} className="group">
            <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
              <div className="aspect-video w-full bg-gradient-to-br from-muted/50 to-muted/20" />
              <CardHeader>
                {post.tags?.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="mb-2">{tag}</Badge>
                ))}
                <CardTitle className="text-xl group-hover:underline">{post.title}</CardTitle>
                <CardDescription>{post.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <time className="text-sm text-muted-foreground">{formatDate(post.date)}</time>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No posts yet. Check back soon!</p>
        </div>
      )}
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
import remarkToc from "remark-toc";
import { env } from "@/lib/env/server";
import { getPost, getPostCanonicalUrl, listPosts } from "@/lib/loaders/blog.loader";
import { safeJsonLd } from "@/lib/seo/jsonld";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function readingTime(content: string) {
  const wpm = 200;
  const words = content.trim().split(/\\s+/).length;
  return Math.ceil(words / wpm);
}

function extractHeadings(content: string) {
  const headings: { level: number; text: string; id: string }[] = [];
  const regex = /^#{1,6}\\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const level = match[0].indexOf(" ");
    const text = match[1];
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    headings.push({ level, text, id });
  }
  return headings.slice(0, 10); // Limit to 10 headings
}

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
      images: [{ url: \`\${baseUrl}/blog/\${post.slug}/opengraph-image\` }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [\`\${baseUrl}/blog/\${post.slug}/opengraph-image\`],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post || !post.published) return notFound();
  
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const canonical = getPostCanonicalUrl({ baseUrl, slug: post.slug, canonicalPath: post.canonicalPath });
  const readTime = readingTime(post.content);
  const headings = extractHeadings(post.content);
  
  // Get related posts (same tags, exclude current)
  const allPosts = await listPosts();
  const related = allPosts
    .filter(p => p.slug !== slug && p.tags?.some(t => post.tags?.includes(t)))
    .slice(0, 3);

  return (
    <>
      {/* Reading Progress Bar */}
      <div className="sticky top-0 z-50 h-0.5 w-full bg-muted">
        <div id="reading-progress" className="h-full w-0 bg-primary transition-all" />
      </div>

      <article className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {post.tags?.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>•</span>
            <span>{readTime} min read</span>
            <span>•</span>
            <span>{process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"} Team</span>
          </div>
        </header>

        {/* Featured Image Placeholder */}
        <div className="mb-8 aspect-video w-full rounded-lg bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />

        {/* Table of Contents */}
        {headings.length > 0 && (
          <nav className="mb-8 rounded-lg border bg-muted/50 p-4">
            <h3 className="mb-3 text-sm font-medium">Table of Contents</h3>
            <ul className="space-y-1">
              {headings.map(h => (
                <li key={h.id} style={{ marginLeft: (h.level - 1) * 12 }}>
                  <a href={\`#\${h.id}\`} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <MDXRemote 
            source={post.content} 
            options={{ 
              mdxOptions: { 
                remarkPlugins: [remarkGfm, remarkToc],
                development: false,
              } 
            }} 
          />
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t pt-8">
          {/* Share Buttons */}
          <div className="mb-8">
            <h3 className="mb-3 text-sm font-medium">Share this post</h3>
            <div className="flex flex-wrap gap-2">
              <a
                href={\`https://twitter.com/intent/tweet?text=\${encodeURIComponent(post.title)}&url=\${encodeURIComponent(canonical)}\`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Twitter
              </a>
              <a
                href={\`https://www.linkedin.com/sharing/share-offsite/?url=\${encodeURIComponent(canonical)}\`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                LinkedIn
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(canonical)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Copy link
              </button>
            </div>
          </div>

          {/* Author Bio */}
          <div className="mb-8 rounded-lg border bg-muted/50 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {(process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack"} Team</p>
                <p className="text-sm text-muted-foreground">Building production-ready architecture for vibecoders</p>
              </div>
            </div>
          </div>

          {/* Related Posts */}
          {related.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-4 text-lg font-medium">Related Posts</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map(r => (
                  <Link key={r.slug} href={\`/blog/\${r.slug}\`}>
                    <Card className="transition-colors hover:bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{r.title}</CardTitle>
                        <CardDescription className="line-clamp-2">{r.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <time className="text-xs text-muted-foreground">{formatDate(r.date)}</time>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back to Blog */}
          <Link href="/blog" className={buttonVariants({ variant: "ghost" })}>
            ← Back to all posts
          </Link>
        </footer>
      </article>

      {/* Reading Progress Script */}
      <script
        dangerouslySetInnerHTML={{
          __html: \`
            (function() {
              const progress = document.getElementById('reading-progress');
              if (!progress) return;
              window.addEventListener('scroll', function() {
                const winScroll = document.documentElement.scrollTop;
                const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = (winScroll / height) * 100;
                progress.style.width = scrolled + '%';
              });
            })();
          \`,
        }}
      />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.date,
            mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
            author: { "@type": "Organization", name: process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack" },
          }),
        }}
      />
    </>
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
      (p) => \`<item><title>\${escapeXml(p.title)}</title><link>\${env.NEXT_PUBLIC_APP_URL}/blog/\${p.slug}</link><description>\${escapeXml(p.description)}</description><pubDate>\${new Date(p.date).toUTCString()}</pubDate></item>\`
    )
    .join("");
  const xml = \`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>\${escapeXml(process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack")} Blog</title>
    <link>\${env.NEXT_PUBLIC_APP_URL}/blog</link>
    <description>Insights on building with 0xstack</description>
    <atom:link href="\${env.NEXT_PUBLIC_APP_URL}/rss.xml" rel="self" type="application/rss+xml" />
    \${items}
  </channel>
</rss>\`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
`
    );

    // Add RSS auto-discovery to layout
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "blog", "layout.tsx"),
      `import { env } from "@/lib/env/server";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="alternate"
        type="application/rss+xml"
        title="Blog RSS Feed"
        href={\`\${env.NEXT_PUBLIC_APP_URL}/rss.xml\`}
      />
      {children}
    </>
  );
}
`
    );
  },
  validate: async () => { },
  sync: async () => { },
};

