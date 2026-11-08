"use client";

import { Icon, type IconName } from "@/components/ui/Icon";

export type CustomerTab = "home" | "ahead" | "accounts" | "help";

/*
  Three of the four names are the real app's own ("At a glance", "My card",
  "Help"). "Look ahead" is ours — the Time Machine has no counterpart in the
  real app, so inventing a Capital One name for it would be the one label on
  this bar that lied about where it went.
*/
const tabs: { id: CustomerTab; label: string; icon: IconName }[] = [
  { id: "home", label: "At a glance", icon: "home" },
  { id: "ahead", label: "Look ahead", icon: "ahead" },
  { id: "accounts", label: "My card", icon: "card" },
  { id: "help", label: "Help", icon: "help" },
];

/**
 * Four destinations, not nine. Icon above label, in the real app's shape, with
 * the active tab marked by a filled pill as well as colour — and announced
 * with `aria-current`, so the state never rests on colour alone.
 *
 * `data-nav` marks these as navigation for the load meter: moving between
 * screens is an option, not a decision the customer has to commit to.
 */
export function BottomNav({
  active,
  onChange,
}: {
  active: CustomerTab;
  onChange: (tab: CustomerTab) => void;
}) {
  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t border-edge bg-glass px-2 pt-1.5 pb-1.5"
    >
      <ul className="flex items-stretch justify-around gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                data-nav
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[48px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-colors ${
                  isActive ? "bg-deep text-fg" : "text-fg-3 hover:text-fg-2"
                }`}
              >
                <Icon name={tab.icon} size={22} />
                <span
                  className={`text-[0.6875rem] leading-none ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
