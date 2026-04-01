import type { NextRequest } from "next/server";
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
