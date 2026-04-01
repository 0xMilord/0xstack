import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";



// 0xSTACK:PWA
// NOTE: keep these tags for installability + iOS.
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack", template: "%s · " + (process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack") },
  description: "Production-ready Next.js starter.",
  openGraph: { type: "website", title: process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack" },
  twitter: { card: "summary_large_image", title: process.env.NEXT_PUBLIC_APP_NAME ?? "0xstack" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 0xSTACK:PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
<body className="min-h-full flex flex-col">
        {/* 0xstack:UI-FOUNDATION */}
        <Providers>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
