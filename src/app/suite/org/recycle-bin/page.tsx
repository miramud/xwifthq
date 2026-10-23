import type { Metadata } from "next";
import RecycleBinBoard from "@/suite/org/components/RecycleBinBoard";

export const metadata: Metadata = {
  title: "Recycle bin",
};

/** Everything deleted in the organisation. See `RecycleBinBoard`. */
export default function RecycleBinPage() {
  return <RecycleBinBoard />;
}
