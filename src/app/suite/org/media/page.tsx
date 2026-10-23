import type { Metadata } from "next";
import { PageHeader } from "@/components/workspace/kit";
import MediaSettingsBoard from "@/suite/org/components/MediaSettingsBoard";

export const metadata: Metadata = {
  title: "Media storage",
  description: "Where this institution keeps its files.",
};

export default function MediaSettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Institution"
        title="Media storage"
        subtitle="Where this institution keeps its lecture videos, documents and images."
      />
      <MediaSettingsBoard />
    </div>
  );
}
