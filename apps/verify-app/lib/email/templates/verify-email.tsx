import * as React from "react";
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
