import type { Metadata } from "next";
import { Poppins, Inter, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth-store";
import { ConfirmProvider } from "@/components/workspace/ConfirmDialog";
import { TourProvider } from "@/components/tour/TourProvider";
import "./globals.css";

/*
  Three roles, same as before the swap: Poppins displays, Inter reads, IBM
  Plex Mono labels data. Each is loaded at the weights actually used in the
  product — a fourth weight nobody uses is bytes on every first paint.
*/
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/*
  The workspace face. Every signed-in suite surface sets in Plus Jakarta Sans
  (see `.ws` in globals.css); the marketing site keeps Poppins and Inter.
*/
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
 * deliberate placeholder rather than a guessed domain — a real-looking one
 * would silently ship wrong canonical and Open Graph URLs.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://elevate.example.com";

const TAGLINE = "Every role has a next step";

/*
  This string is the Open Graph and Twitter fallback for every route that does
  not set its own, so it is what /pricing and the four non-LMS product pages
  inherit. It described a learning platform and nothing else until the suite
  landed — which meant the site's own default metadata contradicted the
  argument the site was making.
*/
const DESCRIPTION =
  "Elevate is five business systems on one spine — LMS, HRM, Finance, Admin and Projects. One identity, one org tree, one permission model, one audit trail.";

export const metadata: Metadata = {
  title: {
    template: `%s | Elevate — ${TAGLINE}`,
    default: `Elevate — ${TAGLINE} | Role-based learning pathways`,
  },
  description: DESCRIPTION,
  keywords: [
    "Elevate",
    "learning management system",
    "enterprise training",
    "role-based learning",
    "learning pathways",
    "staff training",
    "onboarding",
    "compliance training",
    "certification",
    "online courses",
    "workforce development",
    "mobile learning",
    "LMS",
  ],
  authors: [{ name: "Elevate" }],
  creator: "Elevate",
  publisher: "Elevate",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Elevate",
    title: `Elevate — ${TAGLINE}`,
    description: DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `Elevate — ${TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Elevate — ${TAGLINE}`,
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
      className={`${poppins.variable} ${inter.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}
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
