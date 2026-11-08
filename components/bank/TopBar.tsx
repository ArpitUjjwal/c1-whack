"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CapitalOneMark } from "@/components/ui/CapitalOneMark";
import { LiveDot } from "@/components/ui/LiveDot";
import { PROFILE_IDS, profileConfig } from "@/lib/demo-data";
import type { ProfileId } from "@/lib/types";

export function TopBar({
  agentName,
  transport,
  peerCount,
  onReset,
  profileId,
  onSwitchProfile,
}: {
  agentName: string;
  transport: "broadcast-channel" | "storage" | "none";
  peerCount: number;
  onReset: () => void;
  profileId: ProfileId;
  /** Restarts the demo as another customer, on both windows. */
  onSwitchProfile: (id: ProfileId) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <div className="flex items-center gap-4">
          <CapitalOneMark className="w-24" />
          <span aria-hidden="true" className="h-6 w-px bg-edge-2" />
          <div>
            <p className="text-sm leading-tight font-semibold text-fg">
              Adaptive Support · Care Centre
            </p>
            <p className="text-xs leading-tight text-fg-3">
              Accessibility &amp; Financial Wellbeing desk
            </p>
          </div>
        </div>

        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium text-fg-2">
            <LiveDot online={peerCount > 0} />
            {peerCount > 0
              ? `${peerCount} customer window${peerCount === 1 ? "" : "s"} connected`
              : "No customer window open"}
          </span>

          <span className="hidden text-fg-3 lg:inline">
            {transport === "broadcast-channel"
              ? "BroadcastChannel"
              : transport === "storage"
                ? "localStorage fallback"
                : "connecting…"}
          </span>

          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-fg-2">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-link text-[0.5625rem] font-bold text-void"
            >
              {agentName
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <span className="font-medium">{agentName}</span>
          </span>

          <Link
            href="/customer"
            className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-link underline underline-offset-4 hover:text-fg"
          >
            Customer view
          </Link>

          {/*
            `min-w-0` on both, because a flex item defaults to `min-width:auto`
            and a <select> is as wide as its longest <option> — and these
            options carry a whole sentence each. Without it the switcher
            refused to shrink and pushed the document 248px wider than a phone
            viewport, which is a horizontal scrollbar on the whole console.
          */}
          <label className="inline-flex min-w-0 items-center gap-2 font-medium text-fg-2">
            Customer
            <select
              value={profileId}
              onChange={(e) => onSwitchProfile(e.target.value as ProfileId)}
              className="min-h-11 min-w-0 max-w-full rounded-lg border border-edge bg-glass-3 px-2 text-sm font-semibold text-fg"
              title={profileConfig(profileId).summary}
            >
              {PROFILE_IDS.map((id) => (
                <option key={id} value={id}>
                  {profileConfig(id).label} — {profileConfig(id).summary}
                </option>
              ))}
            </select>
          </label>

          <Button size="sm" variant="outline" onClick={onReset}>
            Reset demo
          </Button>
        </div>
      </div>
    </header>
  );
}
