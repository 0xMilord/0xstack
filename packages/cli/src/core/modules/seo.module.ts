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
          `${m}import { getSiteMetadata } from "@/lib/seo/metadata";\nimport { safeJsonLd, websiteJsonLd, organizationJsonLd, softwareApplicationJsonLd } from "@/lib/seo/jsonld";\n`
      );
    } else {
      src = `import { getSiteMetadata } from "@/lib/seo/metadata";\nimport { safeJsonLd, websiteJsonLd, organizationJsonLd, softwareApplicationJsonLd } from "@/lib/seo/jsonld";\n${src}`;
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
    `<body$1>\n        {/* 0xstack:SEO */}\n        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd()) }} />\n        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd()) }} />\n        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(softwareApplicationJsonLd()) }} />`
  );

  await fs.writeFile(layoutPath, src, "utf8");
}

export const seoModule: Module = {
  id: "seo",
  install: async () => { },
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

/**
 * Centralized SEO data source — single source of truth for all JSON-LD and metadata.
 * All SEO values flow from this config.
 */
export function getSeoData() {
  const name = env.NEXT_PUBLIC_APP_NAME ?? "0xstack";
  const description = env.NEXT_PUBLIC_APP_DESCRIPTION ?? "Production-ready Next.js starter.";
  const url = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const twitterHandle = env.NEXT_PUBLIC_TWITTER_HANDLE; // optional

  return {
    name,
    description,
    url,
    twitterHandle,
    logo: \`\${url}/icon.svg\`,
    icon: \`\${url}/icon.svg\`,
  };
}

export function safeJsonLd<T>(data: T): string {
  return JSON.stringify(data).replace(/</g, "\\\\u003c");
}

export function organizationJsonLd() {
  const seo = getSeoData();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.name,
    url: seo.url,
    logo: seo.logo,
    description: seo.description,
  } as const;
}

export function websiteJsonLd() {
  const seo = getSeoData();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.name,
    url: seo.url,
    description: seo.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: \`\${seo.url}/search?q={search_term_string}\`,
      },
      "query-input": "required name=search_term_string",
    },
  } as const;
}

/**
 * SoftwareApplication JSON-LD for SaaS discoverability in SERPs and AI crawlers.
 */
export function softwareApplicationJsonLd(input?: {
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: { price: string; priceCurrency: string }[];
}) {
  const seo = getSeoData();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: seo.name,
    description: seo.description,
    url: seo.url,
    applicationCategory: input?.applicationCategory ?? "DeveloperApplication",
    operatingSystem: input?.operatingSystem ?? "Web",
    offers: input?.offers?.map((o) => ({
      "@type": "Offer",
      price: o.price,
      priceCurrency: o.priceCurrency,
    })),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      ratingCount: "1",
    },
  } as const;
}

/**
 * Organization schema with orgId for multi-tenant setups.
 * Use on org-specific pages when org data is available.
 */
export function localBusinessJsonLd(orgData?: { name: string; orgId: string; url?: string }) {
  const seo = getSeoData();
  const orgName = orgData?.name ?? seo.name;
  const orgUrl = orgData?.url ?? seo.url;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: orgName,
    url: orgUrl,
    description: seo.description,
    identifier: orgData?.orgId,
  } as const;
}

/**
 * FAQPage JSON-LD for FAQ sections.
 */
export function faqPageJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  } as const;
}

/**
 * BreadcrumbList JSON-LD for navigation structure.
 */
export function breadcrumbListJsonLd(items: { name: string; item: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  } as const;
}

/**
 * Article JSON-LD for blog posts and content pages.
 */
export function articleJsonLd(input: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  image?: string;
}) {
  const seo = getSeoData();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: input.author ? { "@type": "Person", name: input.author } : undefined,
    image: input.image ?? \`\${seo.url}/opengraph-image.png\`,
    publisher: {
      "@type": "Organization",
      name: seo.name,
      logo: seo.logo,
    },
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
    const sitemapNoBlog = `import type { MetadataRoute } from "next";
import { env } from "@/lib/env/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [
    { url: new URL("/", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/about", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/contact", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/pricing", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/terms", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/privacy", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/login", baseUrl).toString(), lastModified: new Date() },
    { url: new URL("/get-started", baseUrl).toString(), lastModified: new Date() },
  ];
}
`;
    const sitemapWithBlog = `import type { MetadataRoute } from "next";
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

  // Dynamic import so sitemap works even if blog loader is missing.
  try {
    const { listPosts } = await import("@/lib/loaders/blog.loader");
    const posts = await listPosts();
    for (const p of posts) {
      if (!p.published) continue;
      base.push({ url: new URL(\`/blog/\${p.slug}\`, baseUrl).toString(), lastModified: new Date(p.date || Date.now()) });
    }
    base.push({ url: new URL("/blog", baseUrl).toString(), lastModified: new Date() });
  } catch {
    // blog loader missing or error — skip blog entries
  }

  return base;
}
`;
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "sitemap.ts"),
      ctx.modules.blogMdx ? sitemapWithBlog : sitemapNoBlog
    );

    // Dynamic OG images with satori + lucide icons
    await ensureDir(path.join(ctx.projectRoot, "app", "api", "og"));
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "api", "og", "route.tsx"),
      `import { ImageResponse } from "next/og";
import { getSeoData } from "@/lib/seo/jsonld";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title") || "0xstack";
  const description = url.searchParams.get("description") || "Production-ready Next.js starter";
  const icon = url.searchParams.get("icon") || "zap";

  const seo = getSeoData();

  // Fetch inter font
  const fontData = await fetch(
    "https://og-playground.vercel.app/inter-latin-400-normal.woff"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        {/* Left: Title and description */}
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
              {title}
            </div>
            {description && (
              <div style={{ fontSize: 32, color: "#a3a3a3", lineHeight: 1.4 }}>
                {description}
              </div>
            )}
          </div>
          {/* Right: Icon */}
          <div
            style={{
              width: 160,
              height: 160,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 24,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Simple lightning bolt icon */}
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
        </div>

        {/* Bottom: App name */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 28, color: "#737373" }}>
            {seo.name}
          </div>
          <div style={{ fontSize: 20, color: "#525252" }}>
            {new URL(seo.url).hostname}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Inter", data: fontData, weight: 400, style: "normal" }],
    }
  );
}
`
    );

    // Static OG image (fallback)
    await writeFileEnsured(
      path.join(ctx.projectRoot, "app", "opengraph-image.tsx"),
      `import { ImageResponse } from "next/og";
import { getSeoData } from "@/lib/seo/jsonld";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const seo = getSeoData();

  const fontData = await fetch(
    "https://og-playground.vercel.app/inter-latin-400-normal.woff"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0a0a0a",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.1 }}>
              {seo.name}
            </div>
            <div style={{ marginTop: 24, fontSize: 36, color: "#a3a3a3" }}>
              {seo.description}
            </div>
          </div>
          <div
            style={{
              width: 180,
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 28,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="90"
              height="90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Inter", data: fontData, weight: 400, style: "normal" }],
    }
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
  validate: async () => { },
  sync: async () => { },
};

