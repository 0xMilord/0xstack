import { render } from "@react-email/render";
import { sendResendEmail } from "@/lib/email/resend";
import { VerifyEmailTemplate } from "@/lib/email/templates/verify-email";
import { ResetPasswordTemplate } from "@/lib/email/templates/reset-password";

function appName() {
  return process.env.NEXT_PUBLIC_APP_NAME ?? "App";
}

export async function sendVerifyEmail(input: { to: string; userName: string; verificationUrl: string }) {
  const text = [
    `Verify your email for ${appName()}`,
    "",
    `Hello ${input.userName},`,
    "",
    "Verify email:",
    input.verificationUrl,
    "",
    "If you didn’t request this, you can ignore this email.",
  ].join("\n");
  const html = await render(
    VerifyEmailTemplate({ appName: appName(), userName: input.userName, verificationUrl: input.verificationUrl })
  );
  await sendResendEmail({
    to: input.to,
    subject: `Verify your email for ${appName()}`,
    html,
    text,
  });
}

export async function sendResetPasswordEmail(input: { to: string; userName: string; resetLink: string }) {
  const text = [
    `Reset your password for ${appName()}`,
    "",
    `Hello ${input.userName},`,
    "",
    "Reset password:",
    input.resetLink,
    "",
    "If you didn’t request this, you can ignore this email.",
  ].join("\n");
  const html = await render(
    ResetPasswordTemplate({ appName: appName(), userName: input.userName, resetLink: input.resetLink })
  );
  await sendResendEmail({
    to: input.to,
    subject: `Reset your password for ${appName()}`,
    html,
    text,
  });
}
