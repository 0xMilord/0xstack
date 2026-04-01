import webpush from "web-push";
import { env } from "@/lib/env/server";

export function configureWebPush() {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}
