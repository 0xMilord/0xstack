import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security/headers";
import { buildCsp } from "@/lib/security/csp";
import { getOrCreateRequestId } from "@/lib/security/request-id";

export function proxy(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get("x-request-id"));
  const response = NextResponse.next();

  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response.headers);
  response.headers.set("Content-Security-Policy", buildCsp());

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
