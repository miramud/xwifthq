import { redirect } from "next/navigation";

export default async function OldPersonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/suite/org/users/${encodeURIComponent(id)}/edit`);
}
