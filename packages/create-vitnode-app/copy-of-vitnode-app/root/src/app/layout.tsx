import "./global.css";

import { getLocale } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

import { Body } from "./[locale]/(main)/layout.client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <Body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </Body>
    </html>
  );
}
