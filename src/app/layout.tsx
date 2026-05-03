import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ErrorReportingClient } from "@/components/developer/error-reporting-client";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "CN EXEFLOW",
  title: "CN EXEFLOW",
  description: "CN FOOD 지시 실행, 부서 운영, 승인 흐름을 통제하는 실행 관리 시스템",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CN EXEFLOW",
  },
  icons: {
    apple: "/icons/icon-192.png",
    icon: [
      {
        sizes: "192x192",
        type: "image/png",
        url: "/icons/icon-192.png",
      },
      {
        sizes: "512x512",
        type: "image/png",
        url: "/icons/icon-512.png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#07203f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <ErrorReportingClient />
        {children}
      </body>
    </html>
  );
}
