import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://ahc-viewer.vercel.app";
const siteName = "AHC 延長戦 Viewer";
const siteDescription =
  "AtCoder Heuristic Contest (AHC) の本番・延長戦成績をまとめて表示できるビューア。";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: siteName,
  url: siteUrl,
  description: siteDescription,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  inLanguage: "ja-JP",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
  featureList: [
    "AHC の本番順位・パフォーマンスを一覧表示",
    "延長戦の本番相当順位・パフォーマンスを可視化",
    "各コンテストページへのリンク提供",
  ],
  publisher: {
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: [
    "AtCoder",
    "AHC",
    "AtCoder Heuristic Contest",
    "競技プログラミング",
    "延長戦",
    "ランキング",
    "パフォーマンス",
  ],
  category: "technology",
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: siteName,
    description: siteDescription,
    siteName,
    locale: "ja_JP",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteName} のプレビュー画像`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
