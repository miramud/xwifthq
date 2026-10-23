import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth-store";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { TourProvider } from "@/components/tour/TourProvider";
import "./globals.css";

/*
  Three roles: Plus Jakarta Sans sets headings (and the whole signed-in
  workspace), Inter reads on the public site, IBM Plex Mono labels data. Each
  is loaded only at the weights the product uses.
*/
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * Set `NEXT_PUBLIC_SITE_URL` in the deployment environment. The fallback is a
 * deliberate placeholder rather than a guessed domain: a real looking one
 * would silently ship wrong canonical and Open Graph URLs.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://xwifthq.example.com";

const TAGLINE = "One workspace for your whole company";

/*
  The Open Graph and Twitter fallback for every route that does not set its
  own description.
*/
const DESCRIPTION =
  "XwiftHQ brings finance, operations, HR, projects and learning into one workspace, with one login, one approvals inbox and one audit trail.";

export const metadata: Metadata = {
  title: {
    template: `%s | XwiftHQ`,
    default: `XwiftHQ | ${TAGLINE}`,
  },
  description: DESCRIPTION,
  keywords: [
    "XwiftHQ",
    "all in one business suite",
    "company workspace",
    "finance software",
    "HR and payroll",
    "operations management",
    "project management",
    "approvals workflow",
    "staff training",
    "LMS",
  ],
  authors: [{ name: "XwiftHQ" }],
  creator: "XwiftHQ",
  publisher: "XwiftHQ",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "XwiftHQ",
    title: `XwiftHQ | ${TAGLINE}`,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `XwiftHQ | ${TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `XwiftHQ | ${TAGLINE}`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/*
        Browser extensions (ColorZilla, Grammarly, password managers) write
        attributes onto <body> before React hydrates. suppressHydrationWarning
        ignores attribute mismatches on this element only, not its children.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <StoreProvider>
            <ConfirmProvider>
              {/*
                Navbar and Footer are passed as elements rather than imported by
                SiteChrome, so this layout stays the render site for both and
                Footer stays a Server Component. SiteChrome only decides whether
                they belong on the route — see the comment in that file.
              */}
              <TourProvider>
                <SiteChrome navbar={<Navbar />} footer={<Footer />}>
                  {children}
                </SiteChrome>
              </TourProvider>
            </ConfirmProvider>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
