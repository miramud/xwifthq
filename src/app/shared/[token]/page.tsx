import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lmsFetch } from "@/lib/api/server";
import ClientProjectView, {
  type SharedProject,
} from "@/suite/projects/components/ClientProjectView";

/**
 * A project status page, opened from a link, by somebody with no account.
 *
 * **Server-rendered, and unauthenticated by design.** The token in the URL is
 * the entire authority — see `ShareResolver` on the API side. `lmsFetch` is
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

  return (
    <div className="min-h-screen bg-white">
      <ClientProjectView data={{ ...payload, token }} />
    </div>
  );
}
