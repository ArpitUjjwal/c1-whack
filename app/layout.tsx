import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Geist, Lexend } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/* Reading options on the customer app. Loaded once, used only when chosen. */
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Capital One · Adaptive Support",
  description:
    "A two-surface prototype: a calm mobile banking app for customers with cognitive accessibility needs, and a live support console for the agents helping them.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f5fa",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${lexend.variable} ${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
