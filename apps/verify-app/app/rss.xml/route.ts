import { NextResponse } from "next/server";
import { listPosts } from "@/lib/loaders/blog.loader";
import { env } from "@/lib/env/server";

export async function GET() {
  const posts = await listPosts();
  const items = posts
    .map(
      (p) => `<item><title>${escapeXml(p.title)}</title><link>${env.NEXT_PUBLIC_APP_URL}/blog/${p.slug}</link><description>${escapeXml(p.description)}</description></item>`
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Blog</title><link>${env.NEXT_PUBLIC_APP_URL}</link>${items}</channel></rss>`;
  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
