import type { Metadata } from "next";
import ProfileBoard from "@/suite/org/components/foundations/ProfileBoard";

export const metadata: Metadata = { title: "Organisation profile" };

export default function OrgProfilePage() {
  return <ProfileBoard />;
}
