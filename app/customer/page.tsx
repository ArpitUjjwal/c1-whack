import type { Metadata } from "next";
import { CustomerApp } from "@/components/customer/CustomerApp";
import { LoadingShell } from "@/components/ui/LoadingShell";
import { RealtimeProvider } from "@/lib/realtime";

export const metadata: Metadata = {
  title: "Capital One · Your money, calmly",
  description:
    "A mobile banking view built for cognitive accessibility: one safe-to-spend number, plain language, and a gentle path back from a missed payment.",
};

export default function CustomerPage() {
  return (
    <RealtimeProvider role="customer" initialView="Home"
      fallback={<LoadingShell label="Opening your accounts…" />}
    >
      <CustomerApp />
    </RealtimeProvider>
  );
}
