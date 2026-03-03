"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ProviderForm } from "@/components/providers/provider-form";
import { ProviderList } from "@/components/providers/provider-list";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyStateSimple } from "@/components/ui/empty-state-simple";
import { SETTINGS_COPY } from "@/constants/settings";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/stores/providerStore";

interface ProvidersPanelProps {
  className?: string;
}

export function ProvidersPanel({ className }: ProvidersPanelProps) {
  const { providers, fetchProviders, isLoading, error } = useProviderStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const subtitle = useMemo(() => {
    if (error) {
      return error;
    }
    return SETTINGS_COPY.providersSubtitle;
  }, [error]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-4 rounded-sm border border-border/50 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">{SETTINGS_COPY.providersTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="gap-2"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {SETTINGS_COPY.addProviderButton}
        </Button>
      </div>

      {providers.length === 0 && !isLoading ? (
        <EmptyStateSimple
          title={SETTINGS_COPY.providersEmptyTitle}
          description={SETTINGS_COPY.providersEmptyDescription}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(true)}
            >
              {SETTINGS_COPY.addProviderButton}
            </Button>
          }
        />
      ) : (
        <ProviderList providers={providers} variant="detailed" />
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {SETTINGS_COPY.addProviderModalTitle}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {SETTINGS_COPY.addProviderModalDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <ProviderForm onSuccess={() => setIsModalOpen(false)} showSecurityInfo />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
