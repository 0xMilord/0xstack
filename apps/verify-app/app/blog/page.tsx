import Link from "next/link";
import { listPosts } from "@/lib/loaders/blog.loader";

export default async function Page() {
  const posts = await listPosts();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Blog</h1>
      <div className="mt-6 space-y-4">
        {posts.map((p) => (
          <div key={p.slug} className="rounded-lg border p-4">
            <Link className="text-lg font-medium underline" href={`/blog/${p.slug}`}>
              {p.title}
            </Link>
            <p className="text-sm text-muted-foreground">{p.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
