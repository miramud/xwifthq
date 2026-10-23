import type { Metadata } from "next";
import ExceptionsBoard from "@/suite/finance/components/fcu/ExceptionsBoard";

export const metadata: Metadata = { title: "Exceptions" };

export default function FcuExceptionsPage() {
  return <ExceptionsBoard />;
}
