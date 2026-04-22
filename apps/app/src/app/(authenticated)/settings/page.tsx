"use client";

import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { ProvidersPanel } from "@/components/settings/providers-panel";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_COPY, SETTINGS_TABS } from "@/constants/settings";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams.get("tab");
  const validTabIds: string[] = SETTINGS_TABS.map((tab) => tab.id);
  const activeTab = tabFromQuery && validTabIds.includes(tabFromQuery)
    ? tabFromQuery
    : "providers";

  const handleTabChange = (nextTab: string) => {
    router.replace(`${pathname}?tab=${nextTab}`);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 p-4 sm:p-6 lg:space-y-7 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{SETTINGS_COPY.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{SETTINGS_COPY.subtitle}</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
          <TabsList variant="line" className="w-full border-b border-border/50">
            {SETTINGS_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-2.5">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="providers">
            <ProvidersPanel />
          </TabsContent>

          <TabsContent value="api-keys" forceMount>
            <ApiKeysPanel />
          </TabsContent>

          {SETTINGS_TABS.filter((tab) => tab.id !== "providers" && tab.id !== "api-keys").map(
            (tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                <EmptyStateSimple
                  title={SETTINGS_COPY.emptyTabTitle}
                  description={SETTINGS_COPY.emptyTabDescription}
                  className={cn("rounded-sm border border-border/50 bg-card")}
                />
              </TabsContent>
            )
          )}
        </Tabs>
      </div>
    </div>
  );
}
