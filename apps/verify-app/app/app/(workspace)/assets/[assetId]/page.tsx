import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAssetForViewer } from "@/lib/loaders/assets.loader";
import { assetsDeleteAction } from "@/lib/actions/assets.actions";

export default async function Page({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const { asset } = await loadAssetForViewer(assetId);
  if (!asset) {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Asset not found</h1>
        <Link className={buttonVariants({ variant: "outline" })} href="/app/assets">Back</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Asset details</h1>
        <p className="text-sm text-muted-foreground font-mono break-all">{asset.id}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Content-Type:</span> {asset.contentType ?? "—"}</p>
          <p className="break-all"><span className="text-muted-foreground">Object key:</span> {asset.objectKey}</p>
          <p><span className="text-muted-foreground">Bucket:</span> {asset.bucket}</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <form action={async () => { "use server"; await assetsDeleteAction({ assetId }); }}>
          <button className={buttonVariants({ variant: "destructive" })} type="submit">Delete</button>
        </form>
        <Link className={buttonVariants({ variant: "outline" })} href="/app/assets">Back</Link>
      </div>
    </main>
  );
}
