import path from "node:path";
import fs from "node:fs/promises";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";

async function patchRootLayoutForSeo(projectRoot: string) {
  const layoutPath = path.join(projectRoot, "app", "layout.tsx");
  let src = await fs.readFile(layoutPath, "utf8").catch(() => "");
  if (!src) return;
  if (src.includes("0xstack:SEO")) return;

  // Add imports for metadata + JSON-LD helpers (best-effort).
  if (!src.includes('from "@/lib/seo/metadata"') || !src.includes('from "@/lib/seo/jsonld"')) {
    // Prefer inserting after globals.css import (layout templates always have it).
    if (src.match(/import\s+["']\.\/globals\.css["'];/)) {
      src = src.replace(
        /import\s+["']\.\/globals\.css["'];\s*/m,
        (m) =>
          `${m}import { getSiteMetadata } from "@/lib/seo/metadata";\nimport { safeJsonLd, websiteJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";\n`
      );
    } else {
      src = `import { getSiteMetadata } from "@/lib/seo/metadata";\nimport { safeJsonLd, websiteJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";\n${src}`;
    }
  }

  // Ensure `Metadata` type is imported when we add `metadata` export.
  if (!src.includes('from "next"') || !src.includes("Metadata")) {
    // If they already import from next, add Metadata to that import.
    if (src.match(/import\s+\{\s*[^}]*\}\s+from\s+"next";/)) {
      src = src.replace(/import\s+\{\s*([^}]*)\}\s+from\s+"next";/, (full, inner) => {
        if (String(inner).includes("Metadata")) return full;
        return `import { ${String(inner).trim()}, Metadata } from "next";`;
      });
    } else if (!src.includes('import type { Metadata } from "next"')) {
      src = src.replace(/import\s+"\.\/globals\.css";\s*/m, (m) => `${m}import type { Metadata } from "next";\n`);
    }
  }

  // Add metadata export near top of file.
  if (!src.includes("export const metadata")) {
    const exportDefaultIdx = src.search(/\bexport\s+default\s+(async\s+)?function\s+RootLayout\b/);
    if (exportDefaultIdx !== -1) {
      src =
        src.slice(0, exportDefaultIdx) +
        `// 0xstack:SEO\nexport const metadata: Metadata = getSiteMetadata();\n\n` +
        src.slice(exportDefaultIdx);
    }
  }

  // Inject sitewide JSON-LD into the body wrapper.
  // Note: works with most create-next-app and our ui-foundation patch.
  src = src.replace(
    /<body([^>]*)>/m,
    `<body$1>\n        {/* 0xstack:SEO */}\n        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd()) }} />\n        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd()) }} />`
  );

  await fs.writeFile(layoutPath, src, "utf8");
}

export const seoModule: Module = {
  id: "seo",
  install: async () => {},
  activate: async (ctx) => {
    if (!ctx.modules.seo) {
      await backupAndRemove(ctx.projectRoot, "app/robots.ts");
      await backupAndRemove(ctx.projectRoot, "app/sitemap.ts");
      await backupAndRemove(ctx.projectRoot, "app/opengraph-image.tsx");
      await backupAndRemove(ctx.projectRoot, "app/twitter-image.tsx");
      await backupAndRemove(ctx.projectRoot, "lib/seo/jsonld.ts");
      await backupAndRemove(ctx.projectRoot, "lib/seo/metadata.ts");
      await backupAndRemove(ctx.projectRoot, "lib/seo/runtime.ts");
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "seo"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "seo", "runtime.ts"),
      `import { env } from "@/lib/env/server";

export const SEO_MODULE_ENABLED = true as const;

export function getSeoRuntimeConfig() {
  return {
    enabled: true as const,
    siteUrl: env.NEXT_PUBLIC_APP_URL,
  };
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "seo", "jsonld.ts"),
      `import { env } from "@/lib/env/server";

export function safeJsonLd<T>(data: T): string {
  return JSON.stringify(data).replace(/</g, "\\\\u003c");
}

export function organizationJsonLd() {
  const name = env.NEXT_PUBLIC_APP_NAME ?? "0xstack";
  const url = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
  } as const;
}

export function websiteJsonLd() {
  const name = env.NEXT_PUBLIC_APP_NAME ?? "0xstack";
  const url = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
  } as const;
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "seo", "metadata.ts"),
      `import type { Metadata } from "next";
import { env } from "@/lib/env/server";

export function getSiteUrl() {
  return env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function absoluteUrl(pathname: string) {
  const siteUrl = getSiteUrl();
  return new URL(pathname.startsWith("/") ? pathname : \`/\${pathname}\`, siteUrl).toString();
}

export function getSiteMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const name = env.NEXT_PUBLIC_APP_NAME ?? "0xstack";
  const description = env.NEXT_PUBLIC_APP_DESCRIPTION ?? "Production-ready Next.js starter.";
  const og = absoluteUrl("/opengraph-image");

  return {
    metadataBase: new URL(siteUrl),
    title: { default: name, template: "%s · " + name },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: siteUrl,
      title: name,
      description,
      siteName: name,
      images: [{ url: og, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: [og],
    },
  };
}

export function getPageMetadata(input: { title: string; description?: string; pathname: string }): Metadata {
  const name = env.NEXT_PUBLIC_APP_NAME ?? "0xstack";
  const description = input.description ?? env.NEXT_PUBLIC_APP_DESCRIPTION ?? "Production-ready Next.js starter.";
  const url = absoluteUrl(input.pathname);
  const og = absoluteUrl("/opengraph-image");

  return {
    title: input.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: input.title,
      description,
      siteName: name,
      images: [{ url: og, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description,
      images: [og],
    },
  };
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "robots.ts"),
      `import type { MetadataRoute } from "next";
import { env } from "@/lib/env/server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: \`\${env.NEXT_PUBLIC_APP_URL}/sitemap.xml\`,
  };
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "sitemap.ts"),
      `import type { MetadataRoute } from "next";
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
      base.push({ url: new URL(\`/blog/\${p.slug}\`, baseUrl).toString(), lastModified: new Date(p.date || Date.now()) });
    }
    base.push({ url: new URL("/blog", baseUrl).toString(), lastModified: new Date() });
  } catch {
    // blog disabled or loader missing
  }

  return base;
}
`
    );

    // Social images (basic, but production-valid)
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "opengraph-image.tsx"),
      `import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 64,
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>0xstack</div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#d4d4d4" }}>Production-ready starter</div>
      </div>
    ),
    size
  );
}
`
    );
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "twitter-image.tsx"),
      `export { default, size, contentType, runtime } from "./opengraph-image";\n`
    );

    await patchRootLayoutForSeo(ctx.projectRoot);
  },
  validate: async () => {},
  sync: async () => {},
};

