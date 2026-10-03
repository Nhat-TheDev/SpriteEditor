import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Absolute origin for canonical/OG URLs. Set NEXT_PUBLIC_SITE_URL to override
// (e.g. https://sprite-editor.vercel.app); on Vercel builds the system env var
// VERCEL_PROJECT_PRODUCTION_URL is available, so no config is required there.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const title = "Sprite Editor";
const description =
  "Pixel-art sprite and spritesheet editor: draw frame by frame, animate, and export PNG or spritesheets. Runs entirely in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  keywords: [
    "pixel art",
    "sprite editor",
    "spritesheet",
    "pixel art animation",
    "image editor",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: title,
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}