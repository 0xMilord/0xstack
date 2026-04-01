import type { NextRequest } from "next/server";
import { Checkout } from "@dodopayments/nextjs";
import { env } from "@/lib/env/server";
import { guardApiRequest } from "@/lib/security/api";
import { auth } from "@/lib/auth/auth";

const handler = Checkout({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  returnUrl: env.DODO_PAYMENTS_RETURN_URL,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
  type: "session",
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);
  return handler(req as any);
}

const getHandler = Checkout({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  returnUrl: env.DODO_PAYMENTS_RETURN_URL,
  environment: env.DODO_PAYMENTS_ENVIRONMENT,
  type: "static",
});

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session?.user?.id) await guardApiRequest(req);
  return getHandler(req as any);
}
