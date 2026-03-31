import path from "node:path";
import fs from "node:fs/promises";
import { backupAndRemove, ensureDir, writeFileEnsured } from "./fs-utils";
import type { Module } from "./types";
import { ensureEnvSchemaModuleWiring } from "./env-edit";

async function patchAuthForEmail(projectRoot: string) {
  const authPath = path.join(projectRoot, "lib", "auth", "auth.ts");
  const prev = await fs.readFile(authPath, "utf8");
  if (!prev.includes("betterAuth({")) return;

  // Keep this deterministic to avoid malformed brace insertions.
  const next = `import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { env } from "@/lib/env/server";
import { sendResetPasswordEmail, sendVerifyEmail } from "@/lib/email/auth-emails";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendResetPasswordEmail({
        to: user.email,
        userName: (user as any)?.name ?? user.email,
        resetLink: url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      await sendVerifyEmail({
        to: user.email,
        userName: (user as any)?.name ?? user.email,
        verificationUrl: url,
      });
    },
  },
});
`;

  await fs.writeFile(authPath, next, "utf8");
}

export const emailResendModule: Module = {
  id: "email-resend",
  install: async () => {},
  activate: async (ctx) => {
    const enabled = ctx.modules.email === "resend";
    const filesToRemove = [
      "lib/email/resend.ts",
      "lib/email/auth-emails.ts",
      "lib/email/templates/verify-email.tsx",
      "lib/email/templates/reset-password.tsx",
      "lib/env/email.ts",
    ];
    if (!enabled) {
      for (const f of filesToRemove) await backupAndRemove(ctx.projectRoot, f);
      return;
    }

    await ensureDir(path.join(ctx.projectRoot, "lib", "email", "templates"));
    await ensureDir(path.join(ctx.projectRoot, "lib", "env"));

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "env", "email.ts"),
      `import { z } from "zod";
\nexport const EmailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(1),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "resend.ts"),
      `import { Resend } from "resend";
import { env } from "@/lib/env/server";

export function getResend() {
  return new Resend(env.RESEND_API_KEY);
}

export async function sendResendEmail(input: { to: string; subject: string; html: string; text?: string }) {
  const resend = getResend();
  const res = await resend.emails.send({
    from: env.RESEND_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return res;
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "templates", "verify-email.tsx"),
      `import * as React from "react";
import { Html, Head, Preview, Body, Container, Section, Text, Button, Hr } from "@react-email/components";

export function VerifyEmailTemplate(props: { appName: string; userName: string; verificationUrl: string }) {
  const { appName, userName, verificationUrl } = props;
  return (
    <Html>
      <Head />
      <Preview>Verify your email for {appName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", color: "#0a0a0a", margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        <Container style={{ padding: "24px", maxWidth: "560px" }}>
          <Section>
            <Text style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 12px" }}>{appName}</Text>
            <Text style={{ margin: "0 0 12px" }}>Hi {userName},</Text>
            <Text style={{ margin: "0 0 16px" }}>Confirm your email to finish setting up your account.</Text>
            <Button
              href={verificationUrl}
              style={{
                backgroundColor: "#000000",
                color: "#ffffff",
                padding: "12px 16px",
                borderRadius: "10px",
                textDecoration: "none",
                display: "inline-block",
                fontWeight: 600,
              }}
            >
              Verify email
            </Button>
            <Text style={{ margin: "16px 0 0", fontSize: "12px", color: "#525252" }}>
              If the button doesn’t work, copy and paste this URL into your browser:
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: "12px", color: "#525252", wordBreak: "break-all" }}>
              {verificationUrl}
            </Text>
            <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />
            <Text style={{ margin: 0, fontSize: "12px", color: "#737373" }}>
              If you didn’t request this, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "templates", "reset-password.tsx"),
      `import * as React from "react";
import { Html, Head, Preview, Body, Container, Section, Text, Button, Hr } from "@react-email/components";

export function ResetPasswordTemplate(props: { appName: string; userName: string; resetLink: string }) {
  const { appName, userName, resetLink } = props;
  return (
    <Html>
      <Head />
      <Preview>Reset your password for {appName}</Preview>
      <Body style={{ backgroundColor: "#ffffff", color: "#0a0a0a", margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        <Container style={{ padding: "24px", maxWidth: "560px" }}>
          <Section>
            <Text style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 12px" }}>{appName}</Text>
            <Text style={{ margin: "0 0 12px" }}>Hi {userName},</Text>
            <Text style={{ margin: "0 0 16px" }}>Use the link below to reset your password.</Text>
            <Button
              href={resetLink}
              style={{
                backgroundColor: "#000000",
                color: "#ffffff",
                padding: "12px 16px",
                borderRadius: "10px",
                textDecoration: "none",
                display: "inline-block",
                fontWeight: 600,
              }}
            >
              Reset password
            </Button>
            <Text style={{ margin: "16px 0 0", fontSize: "12px", color: "#525252" }}>
              If the button doesn’t work, copy and paste this URL into your browser:
            </Text>
            <Text style={{ margin: "8px 0 0", fontSize: "12px", color: "#525252", wordBreak: "break-all" }}>
              {resetLink}
            </Text>
            <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />
            <Text style={{ margin: 0, fontSize: "12px", color: "#737373" }}>
              If you didn’t request this, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "auth-emails.ts"),
      `import { render } from "@react-email/render";
import { sendResendEmail } from "@/lib/email/resend";
import { VerifyEmailTemplate } from "@/lib/email/templates/verify-email";
import { ResetPasswordTemplate } from "@/lib/email/templates/reset-password";
import { env } from "@/lib/env/server";
import { getMilordConfig } from "@/lib/0xmilord/config";

function appName() {
  return getMilordConfig().app.name ?? "App";
}

export async function sendVerifyEmail(input: { to: string; userName: string; verificationUrl: string }) {
  const html = await render(
    VerifyEmailTemplate({ appName: appName(), userName: input.userName, verificationUrl: input.verificationUrl })
  );
  await sendResendEmail({
    to: input.to,
    subject: \`Verify your email for \${appName()}\`,
    html,
    text: \`Verify your email: \${input.verificationUrl}\`,
  });
}

export async function sendResetPasswordEmail(input: { to: string; userName: string; resetLink: string }) {
  const html = await render(
    ResetPasswordTemplate({ appName: appName(), userName: input.userName, resetLink: input.resetLink })
  );
  await sendResendEmail({
    to: input.to,
    subject: \`Reset your password for \${appName()}\`,
    html,
    text: \`Reset your password: \${input.resetLink}\`,
  });
}
`
    );

    await patchAuthForEmail(ctx.projectRoot);
  },
  validate: async () => {},
  sync: async () => {},
};

