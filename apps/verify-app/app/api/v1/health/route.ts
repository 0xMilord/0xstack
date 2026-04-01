import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    t: new Date().toISOString(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasBetterAuthSecret: Boolean(process.env.BETTER_AUTH_SECRET),
    hasPublicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  });
}
