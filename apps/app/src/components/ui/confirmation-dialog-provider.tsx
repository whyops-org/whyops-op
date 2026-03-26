"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmationDialogOptions {
  title: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
}

interface ResolvedConfirmationOptions {
  title: string;
  description: string;
  cancelText: string;
  confirmText: string;
}

interface ConfirmationDialogContextValue {
  confirm: (options: ConfirmationDialogOptions) => Promise<boolean>;
  confirmAction: <T>(
    action: () => Promise<T> | T,
    options: ConfirmationDialogOptions
  ) => Promise<T | null>;
}

const DEFAULT_OPTIONS: ResolvedConfirmationOptions = {
  title: "Confirm action",
  description: "Please confirm if you want to continue.",
  cancelText: "Cancel",
  confirmText: "Confirm",
};

const ConfirmationDialogContext = createContext<ConfirmationDialogContextValue | null>(null);

export function ConfirmationDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ResolvedConfirmationOptions>(DEFAULT_OPTIONS);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const closeWithResult = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setIsOpen(false);
  }, []);

  const confirm = useCallback((nextOptions: ConfirmationDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions({
        title: nextOptions.title,
        description: nextOptions.description || DEFAULT_OPTIONS.description,
        cancelText: nextOptions.cancelText || DEFAULT_OPTIONS.cancelText,
        confirmText: nextOptions.confirmText || DEFAULT_OPTIONS.confirmText,
      });
      setIsOpen(true);
    });
  }, []);

  const confirmAction = useCallback(
    async <T,>(
      action: () => Promise<T> | T,
      nextOptions: ConfirmationDialogOptions
    ): Promise<T | null> => {
      const confirmed = await confirm(nextOptions);
      if (!confirmed) {
        return null;
      }

      return action();
    },
    [confirm]
  );

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      confirm,
      confirmAction,
    }),
    [confirm, confirmAction]
  );

  return (
    <ConfirmationDialogContext.Provider value={contextValue}>
      {children}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeWithResult(false);
          }
        }}
      >
        <DialogContent className="max-w-md border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle>{options.title}</DialogTitle>
            <DialogDescription>{options.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" size="sm" variant="outline" onClick={() => closeWithResult(false)}>
              {options.cancelText}
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={() => closeWithResult(true)}>
              {options.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmationDialogContext.Provider>
  );
}

export function useConfirmationDialog() {
  const context = useContext(ConfirmationDialogContext);
  if (!context) {
    throw new Error("useConfirmationDialog must be used within ConfirmationDialogProvider");
  }
  return context;
}

export function useConfirmAction() {
  return useConfirmationDialog().confirmAction;
}
