import type { Metadata } from "next";
import { BankConsole } from "@/components/bank/BankConsole";
import { LoadingShell } from "@/components/ui/LoadingShell";
import { RealtimeProvider } from "@/lib/realtime";

export const metadata: Metadata = {
  title: "Capital One · Care Centre",
  description:
    "The agent side of accessible credit: a live mirror of the customer's app, their declared cognitive needs, behavioural signals, and actions that help rather than pressure.",
};

export default function BankPage() {
  return (
    <RealtimeProvider role="bank" initialView="Console"
      fallback={<LoadingShell label="Connecting to the care console…" />}
    >
      <BankConsole />
    </RealtimeProvider>
  );
}
