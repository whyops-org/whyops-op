"use client";

import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { ProvidersPanel } from "@/components/settings/providers-panel";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_COPY, SETTINGS_TABS } from "@/constants/settings";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-grid">
      <div className="space-y-8 p-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{SETTINGS_COPY.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{SETTINGS_COPY.subtitle}</p>
        </div>

        <Tabs defaultValue="providers" className="space-y-6">
          <TabsList variant="line" className="border-b border-border/40 pb-2">
            {SETTINGS_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-3">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="providers">
            <ProvidersPanel />
          </TabsContent>

          <TabsContent value="api-keys">
            <ApiKeysPanel />
          </TabsContent>

          {SETTINGS_TABS.filter((tab) => tab.id !== "providers" && tab.id !== "api-keys").map(
            (tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                <EmptyStateSimple
                  title={SETTINGS_COPY.emptyTabTitle}
                  description={SETTINGS_COPY.emptyTabDescription}
                  className={cn("rounded-xl border border-border/50 bg-card")}
                />
              </TabsContent>
            )
          )}
        </Tabs>
      </div>
    </div>
  );
}
