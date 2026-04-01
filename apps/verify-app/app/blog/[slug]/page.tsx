import { notFound } from "next/navigation";
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
      images: [{ url: `/blog/${post.slug}/opengraph-image` }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`/blog/${post.slug}/opengraph-image`],
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
            mainEntityOfPage: { "@type": "WebPage", "@id": `/blog/${post.slug}` },
          }),
        }}
      />
    </main>
  );
}
