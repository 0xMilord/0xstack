import crypto from "node:crypto";

export function getOrCreateRequestId(headerValue: string | null): string {
  if (headerValue && headerValue.length >= 8) return headerValue;
  return crypto.randomUUID();
}
