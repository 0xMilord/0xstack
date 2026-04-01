import { Webhook } from "standardwebhooks";

export function verifyDodoWebhook(rawBody: string, headers: Record<string, string | null | undefined>, webhookKey: string) {
  const hook = new Webhook(webhookKey);
  return hook.verify(rawBody, {
    "webhook-id": headers["webhook-id"] ?? "",
    "webhook-signature": headers["webhook-signature"] ?? "",
    "webhook-timestamp": headers["webhook-timestamp"] ?? "",
  });
}
