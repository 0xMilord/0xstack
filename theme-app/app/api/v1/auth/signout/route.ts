import { NextResponse } from "next/server";
import { authService_signOut } from "@/lib/services/auth.service";

export async function POST(req: Request) {
  await authService_signOut(req.headers);
  return NextResponse.json({ ok: true });
}
