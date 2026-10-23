import type { Metadata } from "next";
import AssetRegister from "@/suite/operations/components/assets/AssetRegister";

export const metadata: Metadata = { title: "Asset register" };

/** Everything the organisation owns: status, custodian, value by category. */
export default function AssetRegisterPage() {
  return <AssetRegister />;
}
