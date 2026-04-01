import { NextResponse } from "next/server";
import { viewerService_getViewer } from "@/lib/services/viewer.service";

export async function GET(req: Request) {
  const viewer = await viewerService_getViewer(req.headers);
  return NextResponse.json({ ok: true, viewer });
}
