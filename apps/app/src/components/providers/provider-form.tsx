"use client";

import { Code2, Eye, EyeOff, Key, Plus, ShieldCheck, Sparkles, TestTube, User, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FormField } from "@/components/onboarding/form-field";
import { InfoBox } from "@/components/onboarding/info-box";
import { SelectableCard } from "@/components/onboarding/selectable-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PROVIDER_FORM_COPY } from "@/constants/providers";
import { cn } from "@/lib/utils";
import { useConfigStore, type ProviderType } from "@/stores/configStore";
import { useProviderStore, type ProviderInput } from "@/stores/providerStore";
import { toast } from "sonner";

interface ProviderFormProps {
  onProviderCreated?: () => void | Promise<void>;
  onSuccess?: () => void;
  showSecurityInfo?: boolean;
  className?: string;
}

const providerIcons: Record<ProviderType, typeof Sparkles> = {
  openai: Sparkles,
  anthropic: User,
};

const defaultFormState: ProviderInput = {
  name: "",
  slug: "",
  type: "openai",
  baseUrl: "",
  apiKey: "",
  model: "",
};

export function ProviderForm({
  onProviderCreated,
  onSuccess,
  showSecurityInfo = true,
  className,
}: ProviderFormProps) {
  const {
    testStatus,
    testError,
    error: storeError,
    createProvider,
    testConnection,
    clearError,
  } = useProviderStore();
  const { config, fetchConfig, getDefaultBaseUrl } = useConfigStore();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<ProviderInput>(defaultFormState);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!config) {
      fetchConfig();
    }
  }, [config, fetchConfig]);

  useEffect(() => {
    if (config && !formData.baseUrl) {
      setFormData((prev) => ({
        ...prev,
        baseUrl: getDefaultBaseUrl(prev.type),
      }));
    }
  }, [config, formData.baseUrl, getDefaultBaseUrl]);

  useEffect(() => {
    if (testError) {
      toast.error(testError);
    }
  }, [testError]);

  useEffect(() => {
    if (storeError) {
      toast.error(storeError);
    }
  }, [storeError]);

  const providerTypes = useMemo(() => {
    return (
      config?.providerTypes?.map((pt) => ({
        ...pt,
        icon: providerIcons[pt.type],
      })) ?? []
    );
  }, [config]);

  const resetTestStatus = () => {
    useProviderStore.setState({ testStatus: "idle", testError: null });
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
    clearError();
  };

  const handleTypeSelect = (type: ProviderType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      baseUrl: getDefaultBaseUrl(type),
    }));
    clearError();
    resetTestStatus();
  };

  const handleInputChange = (field: keyof ProviderInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError();

    if (field === "apiKey" || field === "baseUrl" || field === "model") {
      resetTestStatus();
    }
  };

  const handleTestConnection = async () => {
    if (!formData.apiKey || !formData.baseUrl || !formData.model) {
      return;
    }
    await testConnection(formData);
  };

  const handleAddProvider = async () => {
    if (!formData.name || !formData.slug || !formData.apiKey || !formData.baseUrl || !formData.model) {
      return;
    }

    setIsCreating(true);
    try {
      await createProvider(formData);
      await onProviderCreated?.();
      setFormData({
        name: "",
        slug: "",
        type: "openai",
        baseUrl: getDefaultBaseUrl("openai"),
        apiKey: "",
        model: "",
      });
      setShowPassword(false);
      clearError();
      resetTestStatus();
      onSuccess?.();
    } catch {
      // Errors handled in store
    } finally {
      setIsCreating(false);
    }
  };

  const canTest = Boolean(formData.apiKey && formData.baseUrl && formData.model);
  const canCreate = Boolean(
    formData.name &&
      formData.slug &&
      formData.apiKey &&
      formData.baseUrl &&
      formData.model &&
      testStatus === "success"
  );

  if (!config) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner className="h-6 w-6 border-2 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {providerTypes.map((provider) => (
          <SelectableCard
            key={provider.type}
            icon={provider.icon}
            title={provider.name}
            description={provider.detail}
            isSelected={formData.type === provider.type}
            onClick={() => handleTypeSelect(provider.type)}
          />
        ))}
      </div>

      <FormField
        id="provider-name"
        label={PROVIDER_FORM_COPY.nameLabel}
        type="text"
        placeholder={PROVIDER_FORM_COPY.namePlaceholder}
        icon={Key}
        value={formData.name}
        onChange={(e) => handleNameChange(e.target.value)}
      />

      <FormField
        id="provider-slug"
        label={PROVIDER_FORM_COPY.slugLabel}
        type="text"
        placeholder={PROVIDER_FORM_COPY.slugPlaceholder}
        icon={Code2}
        value={formData.slug}
        readOnly
        iconRight={
          formData.slug ? (
            <span className="text-sm text-muted-foreground">{PROVIDER_FORM_COPY.slugHint}</span>
          ) : null
        }
      />

      <input type="hidden" value={formData.type} />

      <FormField
        id="base-url"
        label={PROVIDER_FORM_COPY.baseUrlLabel}
        type="text"
        placeholder={PROVIDER_FORM_COPY.baseUrlPlaceholder}
        icon={Code2}
        value={formData.baseUrl}
        onChange={(e) => handleInputChange("baseUrl", e.target.value)}
      />

      <FormField
        id="test-model"
        label={PROVIDER_FORM_COPY.modelLabel}
        type="text"
        placeholder={PROVIDER_FORM_COPY.modelPlaceholders[formData.type]}
        icon={Sparkles}
        value={formData.model || ""}
        onChange={(e) => handleInputChange("model", e.target.value)}
        hint={PROVIDER_FORM_COPY.modelHint}
      />

      <FormField
        id="api-key"
        label={PROVIDER_FORM_COPY.apiKeyLabel}
        type={showPassword ? "text" : "password"}
        placeholder={PROVIDER_FORM_COPY.apiKeyPlaceholder}
        icon={Key}
        value={formData.apiKey}
        onChange={(e) => handleInputChange("apiKey", e.target.value)}
        iconRight={
          <button
            className="text-muted-foreground/70 transition-colors hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
            type="button"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        }
      />

      <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row sm:items-stretch">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={!canTest || testStatus === "testing"}
          className="h-10 min-h-10 flex-1 shrink-0 whitespace-nowrap px-4"
        >
          {testStatus === "testing" ? (
            <>
              <Spinner className="mr-2 h-4 w-4 border-2" />
              {PROVIDER_FORM_COPY.testingButton}
            </>
          ) : (
            <>
              <TestTube className="mr-2 h-4 w-4" />
              {PROVIDER_FORM_COPY.testButton}
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleAddProvider}
          disabled={!canCreate || isCreating}
          className="h-10 min-h-10 flex-1 shrink-0 whitespace-nowrap px-4"
        >
          {isCreating ? (
            <>
              <Spinner className="mr-2 h-4 w-4 border-2" />
              {PROVIDER_FORM_COPY.addingButton}
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              {PROVIDER_FORM_COPY.addButton}
            </>
          )}
        </Button>
      </div>

      {testStatus === "success" && (
        <InfoBox variant="success" icon={Wifi} title={PROVIDER_FORM_COPY.successTitle}>
          {PROVIDER_FORM_COPY.successBody}
        </InfoBox>
      )}

      {showSecurityInfo && (
        <InfoBox variant="success" icon={ShieldCheck} title={PROVIDER_FORM_COPY.securityTitle}>
          {PROVIDER_FORM_COPY.securityBody}
        </InfoBox>
      )}
    </div>
  );
}
