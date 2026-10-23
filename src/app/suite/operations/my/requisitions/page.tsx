import type { Metadata } from "next";
import MyRequisitions from "@/suite/operations/components/my-requisitions/MyRequisitions";

export const metadata: Metadata = { title: "My requisitions" };

/** Consumables I asked the stores for, and the vouchers waiting for me to acknowledge. */
export default function MyRequisitionsPage() {
  return <MyRequisitions />;
}
