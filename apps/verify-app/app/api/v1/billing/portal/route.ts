import type { NextRequest } from "next/server";
import { CustomerPortal } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { guardApiRequest } from "@/lib/security/api";
import { auth } from "@/lib/auth/auth";

const handler = CustomerPortal({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);
  return handler(req as any);
}
