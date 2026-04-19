import { useEffect, useMemo, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { MasterKey } from "@/stores/projectStore";

interface ApiKeyFetchError {
  id: string;
  message: string;
}

export function useResolvedApiKey(activeKey: MasterKey | null) {
  const [fetchedApiKey, setFetchedApiKey] = useState<{ id: string; value: string } | null>(null);
  const [apiKeyFetchError, setApiKeyFetchError] = useState<ApiKeyFetchError | null>(null);
  const activeKeyId = activeKey?.id;
  const activeKeyValue = activeKey?.key;
  const canReveal = Boolean(activeKey?.canReveal);

  useEffect(() => {
    if (!activeKeyId || activeKeyValue || !canReveal) return;

    let cancelled = false;
    apiClient
      .get<{ apiKey: string }>(`/api/api-keys/${activeKeyId}/unmasked`)
      .then(({ data }) => {
        if (!cancelled) {
          setFetchedApiKey({ id: activeKeyId, value: data.apiKey });
          setApiKeyFetchError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiKeyFetchError({
            id: activeKeyId,
            message: "Failed to load an existing API key. Go back and generate a fresh one.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeKeyId, activeKeyValue, canReveal]);

  return useMemo(() => {
    const resolvedApiKey =
      activeKeyValue || (activeKeyId && fetchedApiKey?.id === activeKeyId ? fetchedApiKey.value : "");
    const apiKeyError = !activeKey
      ? "Go back to Workspace and generate an API key to load a real snippet."
      : !activeKeyValue && !canReveal
        ? "Go back to Workspace and generate a fresh API key to load a real snippet."
        : activeKeyId && apiKeyFetchError?.id === activeKeyId
          ? apiKeyFetchError.message
          : null;
    const isResolvingApiKey = Boolean(
      activeKeyId &&
        !activeKeyValue &&
        canReveal &&
        fetchedApiKey?.id !== activeKeyId &&
        apiKeyFetchError?.id !== activeKeyId
    );

    return { resolvedApiKey, apiKeyError, isResolvingApiKey };
  }, [activeKey, activeKeyId, activeKeyValue, canReveal, fetchedApiKey, apiKeyFetchError]);
}
