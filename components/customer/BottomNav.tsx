"use client";

export type CustomerTab = "home" | "ahead" | "accounts" | "help";

const tabs: { id: CustomerTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "ahead", label: "Look ahead" },
  { id: "accounts", label: "Accounts" },
  { id: "help", label: "Help" },
];

/**
 * Four destinations, not nine. Every tab is labelled in words, and the active
 * one is announced with `aria-current` rather than signalled by colour alone.
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
      className="shrink-0 border-t border-edge bg-deep/80 px-3 pt-2 pb-3 backdrop-blur-xl"
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
                className={`flex min-h-11 w-full items-center justify-center rounded-xl px-2 text-[0.8125rem] font-semibold transition-colors ${
                  isActive
                    ? "bg-glass-2 text-fg"
                    : "text-fg-3 hover:bg-glass hover:text-fg-2"
                }`}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
