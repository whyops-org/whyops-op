import Image from "next/image";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabSelectorProps {
  tabs: readonly Tab[];
  selectedTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabSelector({ tabs, selectedTab, onTabChange, className }: TabSelectorProps) {
  return (
    <div className={cn("flex items-center gap-5 border-b border-border/50", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative flex items-center gap-2 py-3 text-sm font-medium transition-colors",
            selectedTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.icon ? (
            tab.icon.startsWith("/") ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                <Image
                  src={tab.icon}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                  aria-hidden="true"
                  unoptimized
                />
              </span>
            ) : (
              <span className="text-base leading-none">{tab.icon}</span>
            )
          ) : null}
          {tab.label}
          {selectedTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}
