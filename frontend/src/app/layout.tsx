import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

// Ledger typefaces: Geist for text and figures (tabular digits); Geist Mono only for code.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgencyPulse",
  description: "Premium workforce management for modern agencies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        {/* Sets light or dark before first paint so the theme never flashes. */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
      </head>
      <body className="theme-ledger min-h-full">{children}</body>
    </html>
  );
}
