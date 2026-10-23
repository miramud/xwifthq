import { redirect } from "next/navigation";

/** Moved to the platform console. Old bookmarks land in the right place. */
export default async function MovedOrganisationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/suite/platform/organisations/${encodeURIComponent(slug)}`);
}
