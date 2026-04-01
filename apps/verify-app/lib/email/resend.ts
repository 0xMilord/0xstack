import { Resend } from "resend";
import { env } from "@/lib/env/server";

export function getResend() {
  return new Resend(env.RESEND_API_KEY);
}

export async function sendResendEmail(input: { to: string; subject: string; html: string; text?: string }) {
  const resend = getResend();
  if (!env.RESEND_FROM) throw new Error("Missing RESEND_FROM");
  const res = await resend.emails.send({
    from: env.RESEND_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return res;
}
