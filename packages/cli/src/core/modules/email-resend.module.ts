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
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "templates", "verify-email.tsx"),
      `import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const base = {
  bg: "#0a0a0a",
  panel: "#0f0f0f",
  border: "#262626",
  text: "#fafafa",
  muted: "#a3a3a3",
  subtle: "#737373",
  brand: "#ffffff",
  brandText: "#000000",
};

function Shell(props: { appName: string; preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: base.bg, color: base.text, margin: 0, padding: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        <Container style={{ maxWidth: "560px", padding: "28px 20px" }}>
          <Section style={{ marginBottom: "14px" }}>
            <Text style={{ margin: 0, fontSize: "13px", color: base.muted, letterSpacing: "0.2px" }}>
              {props.appName}
            </Text>
          </Section>
          <Section style={{ backgroundColor: base.panel, border: "1px solid " + base.border, borderRadius: "14px", padding: "22px" }}>
            {props.children}
          </Section>
          <Section style={{ padding: "14px 2px 0" }}>
            <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
              Sent by {props.appName}. If you didn’t request this, you can ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function monoLink(url: string) {
  return (
    <Text style={{ margin: "10px 0 0", fontSize: "12px", color: base.muted, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {url}
    </Text>
  );
}

export function VerifyEmailTemplate(props: { appName: string; userName: string; verificationUrl: string }) {
  const { appName, userName, verificationUrl } = props;
  return (
    <Shell appName={appName} preview={"Verify your email for " + appName}>
      <Section>
        <Text style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 650, letterSpacing: "-0.2px" }}>
          Verify your email
        </Text>
        <Text style={{ margin: "0 0 14px", fontSize: "14px", color: base.muted }}>
          Hi {userName}, confirm this email to finish setting up your account.
        </Text>

        <Section style={{ margin: "16px 0 10px" }}>
          <Button
            href={verificationUrl}
            style={{
              backgroundColor: base.brand,
              color: base.brandText,
              padding: "12px 16px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            Verify email
          </Button>
        </Section>

        <Text style={{ margin: "14px 0 0", fontSize: "12px", color: base.subtle }}>
          If the button doesn’t work, open this link:
        </Text>
        {monoLink(verificationUrl)}

        <Hr style={{ borderColor: base.border, margin: "18px 0" }} />

        <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
          For security, this link may expire. If it does, sign in and request a new verification email.
        </Text>
        <Text style={{ margin: "10px 0 0", fontSize: "12px", color: base.subtle }}>
          Need help? Contact support.
        </Text>
      </Section>
    </Shell>
  );
}
`
    );

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "templates", "reset-password.tsx"),
      `import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const base = {
  bg: "#0a0a0a",
  panel: "#0f0f0f",
  border: "#262626",
  text: "#fafafa",
  muted: "#a3a3a3",
  subtle: "#737373",
  brand: "#ffffff",
  brandText: "#000000",
};

function Shell(props: { appName: string; preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: base.bg, color: base.text, margin: 0, padding: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        <Container style={{ maxWidth: "560px", padding: "28px 20px" }}>
          <Section style={{ marginBottom: "14px" }}>
            <Text style={{ margin: 0, fontSize: "13px", color: base.muted, letterSpacing: "0.2px" }}>
              {props.appName}
            </Text>
          </Section>
          <Section style={{ backgroundColor: base.panel, border: "1px solid " + base.border, borderRadius: "14px", padding: "22px" }}>
            {props.children}
          </Section>
          <Section style={{ padding: "14px 2px 0" }}>
            <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
              Sent by {props.appName}. If you didn’t request this, you can ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function monoLink(url: string) {
  return (
    <Text style={{ margin: "10px 0 0", fontSize: "12px", color: base.muted, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
      {url}
    </Text>
  );
}

export function ResetPasswordTemplate(props: { appName: string; userName: string; resetLink: string }) {
  const { appName, userName, resetLink } = props;
  return (
    <Shell appName={appName} preview={"Reset your password for " + appName}>
      <Section>
        <Text style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 650, letterSpacing: "-0.2px" }}>
          Reset your password
        </Text>
        <Text style={{ margin: "0 0 14px", fontSize: "14px", color: base.muted }}>
          Hi {userName}, use the link below to choose a new password.
        </Text>

        <Section style={{ margin: "16px 0 10px" }}>
          <Button
            href={resetLink}
            style={{
              backgroundColor: base.brand,
              color: base.brandText,
              padding: "12px 16px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            Reset password
          </Button>
        </Section>

        <Text style={{ margin: "14px 0 0", fontSize: "12px", color: base.subtle }}>
          If the button doesn’t work, open this link:
        </Text>
        {monoLink(resetLink)}

        <Hr style={{ borderColor: base.border, margin: "18px 0" }} />

        <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
          If you suspect someone else requested this email, secure your account after you sign in.
        </Text>
        <Text style={{ margin: "10px 0 0", fontSize: "12px", color: base.subtle }}>
          Need help? Contact support.
        </Text>
      </Section>
    </Shell>
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

function appName() {
  return process.env.NEXT_PUBLIC_APP_NAME ?? "App";
}

export async function sendVerifyEmail(input: { to: string; userName: string; verificationUrl: string }) {
  const text = [
    \`Verify your email for \${appName()}\`,
    "",
    \`Hello \${input.userName},\`,
    "",
    "Verify email:",
    input.verificationUrl,
    "",
    "If you didn’t request this, you can ignore this email.",
  ].join("\\n");
  const html = await render(
    VerifyEmailTemplate({ appName: appName(), userName: input.userName, verificationUrl: input.verificationUrl })
  );
  await sendResendEmail({
    to: input.to,
    subject: \`Verify your email for \${appName()}\`,
    html,
    text,
  });
}

export async function sendResetPasswordEmail(input: { to: string; userName: string; resetLink: string }) {
  const text = [
    \`Reset your password for \${appName()}\`,
    "",
    \`Hello \${input.userName},\`,
    "",
    "Reset password:",
    input.resetLink,
    "",
    "If you didn’t request this, you can ignore this email.",
  ].join("\\n");
  const html = await render(
    ResetPasswordTemplate({ appName: appName(), userName: input.userName, resetLink: input.resetLink })
  );
  await sendResendEmail({
    to: input.to,
    subject: \`Reset your password for \${appName()}\`,
    html,
    text,
  });
}
`
    );

    await patchAuthForEmail(ctx.projectRoot);
  },
  validate: async () => {},
  sync: async () => {},
};

