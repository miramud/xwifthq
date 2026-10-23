import { Suspense } from "react";
import type { Metadata } from "next";
import OrdersBoard from "@/suite/operations/components/procurement/OrdersBoard";

export const metadata: Metadata = { title: "Purchase orders" };

/** LPOs and LSOs (`?tab=draft|open|all`). */
export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersBoard />
    </Suspense>
  );
}
