import path from "node:path";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

export const blogMdxModule: Module = {
  id: "blogMdx",
  install: async () => {},
  activate: async (ctx) => {
    if (!ctx.modules.blogMdx) {
      await backupAndRemove(ctx.projectRoot, "app/blog/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/blog/[slug]/page.tsx");
      await backupAndRemove(ctx.projectRoot, "app/rss.xml/route.ts");
      await backupAndRemove(ctx.projectRoot, "lib/loaders/blog.loader.ts");
      await backupAndRemove(ctx.projectRoot, "content/blog/hello-world.mdx");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "content", "blog"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "loaders"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "content", "blog", "hello-world.mdx"),
      `---\ntitle: Hello World\ndescription: First post\ndate: 2026-03-31\npublished: true\n---\n\n# Hello World\n\nThis is your first post.\n`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "loaders", "blog.loader.ts"),
      `import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  published: boolean;
  content: string;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export const listPosts = cache(async (): Promise<BlogPost[]> => {
  const entries = await fs.readdir(BLOG_DIR);
  const posts: BlogPost[] = [];
  for (const file of entries) {
    if (!file.endsWith(".mdx")) continue;
    const slug = file.replace(/\\.mdx$/, "");
    const raw = await fs.readFile(path.join(BLOG_DIR, file), "utf8");
    const parsed = matter(raw);
    posts.push({
      slug,
      title: String(parsed.data.title ?? slug),
      description: String(parsed.data.description ?? ""),
      date: String(parsed.data.date ?? ""),
      published: parsed.data.published !== false,
      content: parsed.content,
    });
  }
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
});

export const getPost = cache(async (slug: string) => {
  const raw = await fs.readFile(path.join(BLOG_DIR, \`\${slug}.mdx\`), "utf8");
  const parsed = matter(raw);
  return {
    slug,
    title: String(parsed.data.title ?? slug),
    description: String(parsed.data.description ?? ""),
    date: String(parsed.data.date ?? ""),
    published: parsed.data.published !== false,
    content: parsed.content,
  } satisfies BlogPost;
});
`
    );

    await ensureDir(path.join(ctx.projectRoot, "app", "blog", "[slug]"));
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
import { getPost } from "@/lib/loaders/blog.loader";
import { safeJsonLd } from "@/lib/seo/jsonld";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug).catch(() => null);
  if (!post) return notFound();
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
  validate: async () => {},
  sync: async () => {},
};

