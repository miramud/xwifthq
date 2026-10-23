import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { XwiftLockup } from "@/components/shared/BrandLogo";
import { lmsFetch } from "@/lib/api/server";
import ClientProjectView, {
  type SharedProject,
} from "@/suite/projects/components/ClientProjectView";

/**
 * A project status page, opened from a link, by somebody with no account.
 *
 * **Server-rendered, and unauthenticated by design.** The token in the URL is
 * the entire authority (see `ShareResolver` on the API side). `lmsFetch` is
 * called without `auth`, so no cookie is read and none is needed: a client
 * opening this in a browser that has never seen the product gets the page.
 *
 * **Never indexed.** A shared link is not a search result, and a project
 * status page sitting in Google is a breach nobody had to attack. `robots` is
 * set here and the API sends `X-Robots-Tag` on the document bytes as well,
 * because one of the two will eventually be forgotten.
 *
 * **Every failure is a 404**, matching the API exactly. Distinguishing
 * "revoked" from "never existed" would tell somebody guessing which guesses
 * are getting warmer.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Project status",
  robots: { index: false, follow: false },
};

export default async function SharedProjectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await lmsFetch<{ data: Omit<SharedProject, "token"> }>(
    `/projects/shared/${encodeURIComponent(token)}`,
  );

  const payload = result.data?.data;

  if (!result.ok || payload === undefined) {
    notFound();
  }

  /*
    The marketing navbar stays off this route (see SiteChrome), so the page
    carries one slim bar of its own: who made the page, and a plain note that
    it is a read-only view. Nothing in it asks a client to sign in.
  */
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-neutral-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="XwiftHQ home"
            className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <XwiftLockup markClassName="h-7 w-7" wordClassName="text-lg" />
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Read-only view
          </span>
        </div>
      </header>
      <ClientProjectView data={{ ...payload, token }} />
    </div>
  );
}
