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
  install: async () => { },
  activate: async (ctx) => {
    const enabled = ctx.modules.email === "resend";
    const filesToRemove = [
      "lib/email/resend.ts",
      "lib/email/auth-emails.ts",
      "lib/email/templates/verify-email.tsx",
      "lib/email/templates/reset-password.tsx",
      "lib/env/email.ts",
      "lib/email/EMAIL_SETUP.md",
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
  COMPANY_ADDRESS: z.string().min(1).optional(),
});
`
    );
    await ensureEnvSchemaModuleWiring(ctx.projectRoot);

    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "EMAIL_SETUP.md"),
      `# Email Infrastructure Setup (Resend)

This project uses Resend for transactional email delivery. To send emails in production, you must verify your domain by configuring the following DNS records.

## 1. Verify Your Domain
1. Go to the [Resend Domains Dashboard](https://resend.com/domains).
2. Click **Add Domain** and enter your production domain (e.g., \`example.com\`).
3. Resend will provide a set of DNS records (SPF, DKIM, and DMARC).

## 2. DNS Configuration
Add the provided records to your domain provider (e.g., Cloudflare, Vercel, Route53, Namecheap). They typically look like this:

### SPF/DKIM Records (Required for deliverability)
| Type  | Name / Host     | Value / Data                                |
|-------|----------------|---------------------------------------------|
| TXT   | \`bounces\`        | \`v=spf1 include:amazonses.com ~all\`         |
| CNAME | \`resend._domainkey\` | \`resend._domainkey.example.com\`         |

### DMARC Policy (Highly Recommended)
We stronly recommend enforcing DMARC to prevent spoofing.
| Type | Name / Host | Value / Data                               |
|------|-------------|--------------------------------------------|
| TXT  | \`_dmarc\`    | \`v=DMARC1; p=quarantine; adkim=r; aspf=r;\` |

## 3. Environment Variables
Once your domain is verified and records propagate (can take up to 24 hours), update your \`.env.local\` and production environment variables:

\`\`\`env
RESEND_API_KEY="re_..."
RESEND_FROM="0xstack Notifications <noreply@yourdomain.com>"
COMPANY_ADDRESS="123 Innovation Dr, San Francisco, CA"
\`\`\`

> **Note on Test Mode:** While developing locally, you can use continuous test keys (\`re_test_...\`) to print links in the console and test templates without actually sending emails.
`
    );

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
  bg: "#ffffff",
  panel: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  subtle: "#9ca3af",
  brand: "#000000",
  brandText: "#ffffff",
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
              Sent by {props.appName}. If you didn't request this, you can ignore it.
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
          Hi {userName}, welcome to {appName}! Confirm your email to get started.
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
          If the button doesn't work, open this link:
        </Text>
        {monoLink(verificationUrl)}

        <Hr style={{ borderColor: base.border, margin: "18px 0" }} />

        <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
          For security, this link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </Text>
        <Text style={{ margin: "10px 0 0", fontSize: "12px", color: base.subtle }}>
          Need help? Contact our support team.
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
  bg: "#ffffff",
  panel: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  subtle: "#9ca3af",
  brand: "#000000",
  brandText: "#ffffff",
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
            <Hr style={{ borderColor: base.border, margin: "12px 0" }} />
            <Text style={{ margin: "0 0 8px", fontSize: "11px", color: base.subtle }}>
              Sent by {props.appName}. If you didn't request this, you can safely ignore it.
            </Text>
            <Text style={{ margin: 0, fontSize: "10px", color: base.subtle }}>
              © {new Date().getFullYear()} {props.appName} Inc. • 123 Innovation Dr, San Francisco, CA 94105
            </Text>
            <Text style={{ margin: "4px 0 0", fontSize: "10px", color: base.subtle }}>
              <Link href="mailto:support@company.com" style={{ color: base.muted, textDecoration: "underline" }}>Contact Support</Link>
              {" • "}
              <Link href="https://company.com/privacy" style={{ color: base.muted, textDecoration: "underline" }}>Privacy Policy</Link>
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
          If the button doesn't work, open this link:
        </Text>
        {monoLink(resetLink)}

        <Hr style={{ borderColor: base.border, margin: "18px 0" }} />

        <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
          This link expires in 24 hours for your security. If you didn't request this password reset, you can safely ignore this email.
        </Text>
        <Text style={{ margin: "10px 0 0", fontSize: "12px", color: base.subtle }}>
          Need help? Contact our support team.
        </Text>
      </Section>
    </Shell>
  );
}
`
    );

    // Welcome email template
    await writeFileEnsured(
      path.join(ctx.projectRoot, "lib", "email", "templates", "welcome-email.tsx"),
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
  bg: "#ffffff",
  panel: "#f9fafb",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  subtle: "#9ca3af",
  brand: "#000000",
  brandText: "#ffffff",
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
            <Hr style={{ borderColor: base.border, margin: "12px 0" }} />
            <Text style={{ margin: "0 0 8px", fontSize: "11px", color: base.subtle }}>
              Sent by {props.appName}.
            </Text>
            <Text style={{ margin: 0, fontSize: "10px", color: base.subtle }}>
              © {new Date().getFullYear()} {props.appName} Inc. • 123 Innovation Dr, San Francisco, CA 94105
            </Text>
            <Text style={{ margin: "4px 0 0", fontSize: "10px", color: base.subtle }}>
              <Link href="mailto:support@company.com" style={{ color: base.muted, textDecoration: "underline" }}>Contact Support</Link>
              {" • "}
              <Link href="https://company.com/privacy" style={{ color: base.muted, textDecoration: "underline" }}>Privacy Policy</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function WelcomeEmailTemplate(props: { appName: string; userName: string; dashboardUrl: string }) {
  const { appName, userName, dashboardUrl } = props;
  return (
    <Shell appName={appName} preview={"Welcome to " + appName + "!"}>
      <Section>
        <Text style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.2px" }}>
          Welcome to {appName}! 🎉
        </Text>
        <Text style={{ margin: "0 0 14px", fontSize: "14px", color: base.muted }}>
          Hi {userName}, we're thrilled to have you on board. Your account is all set up and ready to go.
        </Text>

        <Section style={{ margin: "20px 0" }}>
          <Button
            href={dashboardUrl}
            style={{
              backgroundColor: base.brand,
              color: base.brandText,
              padding: "14px 20px",
              borderRadius: "12px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: 700,
              fontSize: "15px",
            }}
          >
            Go to Dashboard
          </Button>
        </Section>

        <Section style={{ margin: "20px 0", padding: "16px", backgroundColor: base.bg, borderRadius: "8px" }}>
          <Text style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>Quick Start Guide:</Text>
          <Text style={{ margin: "4px 0", fontSize: "13px", color: base.muted }}>• Complete your profile settings</Text>
          <Text style={{ margin: "4px 0", fontSize: "13px", color: base.muted }}>• Invite your team members</Text>
          <Text style={{ margin: "4px 0", fontSize: "13px", color: base.muted }}>• Explore the features</Text>
        </Section>

        <Hr style={{ borderColor: base.border, margin: "18px 0" }} />

        <Text style={{ margin: 0, fontSize: "12px", color: base.subtle }}>
          Questions or feedback? We're here to help. Just reply to this email or visit our Help Center.
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
import { WelcomeEmailTemplate } from "@/lib/email/templates/welcome-email";

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
    "If you didn't request this, you can ignore this email.",
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
    "If you didn't request this, you can ignore this email.",
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

export async function sendWelcomeEmail(input: { to: string; userName: string; dashboardUrl: string }) {
  const text = [
    \`Welcome to \${appName()}!\`,
    "",
    \`Hi \${input.userName},\`,
    "",
    "We're thrilled to have you on board!",
    "",
    "Get started:",
    input.dashboardUrl,
    "",
    "Questions? Just reply to this email.",
  ].join("\\n");
  const html = await render(
    WelcomeEmailTemplate({ appName: appName(), userName: input.userName, dashboardUrl: input.dashboardUrl })
  );
  await sendResendEmail({
    to: input.to,
    subject: \`Welcome to \${appName()}! Let's get started 🎉\`,
    html,
    text,
  });
}
`
    );

    await patchAuthForEmail(ctx.projectRoot);
  },
  validate: async () => { },
  sync: async () => { },
};

