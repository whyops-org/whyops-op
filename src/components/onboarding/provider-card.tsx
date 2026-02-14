import { Code2, Eye, EyeOff, Key, Loader2, Plus, ShieldCheck, Sparkles, TestTube, User, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "./form-field";
import { InfoBox } from "./info-box";
import { SelectableCard } from "./selectable-card";
import { StepContainer } from "./step-container";
import { StepNavigation } from "./step-navigation";
import { toast } from "sonner";
import { useConfigStore, type ProviderType } from "@/stores/configStore";
import { useProviderStore, type ProviderInput } from "@/stores/providerStore";
import { useAuthStore } from "@/stores/authStore";

interface ProviderCardProps {
  onBack?: () => void;
  onContinue?: () => void;
}

// Map provider types to icons
const providerIcons: Record<ProviderType, typeof Sparkles> = {
  openai: Sparkles,
  anthropic: User,
};

export function ProviderCard({ onBack, onContinue }: ProviderCardProps) {
  const { fetchOnboardingProgress } = useAuthStore();
  const {
    providers,
    testStatus,
    testError,
    error: storeError,
    fetchProviders,
    createProvider,
    testConnection,
    clearError,
  } = useProviderStore();

  const { config, fetchConfig, getDefaultBaseUrl } = useConfigStore();

  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<ProviderInput>({
    name: "",
    slug: "",
    type: "openai",
    baseUrl: "",
    apiKey: "",
    model: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Show errors as toast notifications
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

  // Generate slug from name in real-time
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-") // Remove duplicate hyphens
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  };

  // Update slug when name changes
  const handleNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: generateSlug(value),
    }));
    clearError();
  };

  // Load config and providers on mount
  useEffect(() => {
    fetchConfig();
    fetchProviders();
  }, [fetchConfig, fetchProviders]);

  // Initialize default base URL after config is loaded
  useEffect(() => {
    if (config && !formData.baseUrl) {
      setFormData((prev) => ({
        ...prev,
        baseUrl: getDefaultBaseUrl(prev.type),
      }));
    }
  }, [config, formData.baseUrl, getDefaultBaseUrl]);

  // Auto-fill base URL when type changes
  useEffect(() => {
    if (selectedType) {
      const defaultUrl = getDefaultBaseUrl(selectedType);
      setFormData((prev) => ({
        ...prev,
        type: selectedType,
        baseUrl: defaultUrl,
      }));
    }
  }, [selectedType, getDefaultBaseUrl]);

  const handleTypeSelect = (type: ProviderType) => {
    setSelectedType(type);
    clearError();
  };

  const handleInputChange = (field: keyof ProviderInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError();
    // Reset test status when form values change - user must test again
    if (field === "apiKey" || field === "baseUrl") {
      useProviderStore.setState({ testStatus: "idle" });
    }
  };

  const handleTestConnection = async () => {
    if (!formData.apiKey || !formData.baseUrl || !formData.model) {
      return;
    }
    await testConnection(formData);
  };

  const handleAddProvider = async () => {
    if (!formData.name || !formData.slug || !formData.apiKey || !formData.baseUrl) {
      return;
    }

    setIsCreating(true);
    try {
      await createProvider(formData);
      // Refresh onboarding progress after creating provider
      await fetchOnboardingProgress();
      // Reset form after successful creation
      setFormData({
        name: "",
        slug: "",
        type: "openai",
        baseUrl: getDefaultBaseUrl("openai"),
        apiKey: "",
        model: "",
      });
      setSelectedType(null);
      clearError();
    } catch {
      // Error is handled in store
    } finally {
      setIsCreating(false);
    }
  };

  const canContinue = providers.length > 0;

  // Get provider types from config
  const providerTypes = config?.providerTypes?.map((pt) => ({
    ...pt,
    icon: providerIcons[pt.type],
  })) ?? [];

  // Show loading state while config is loading
  if (!config) {
    return (
      <StepContainer>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StepContainer>
    );
  }

  return (
    <>
      <StepContainer>
        {/* Existing Providers List */}
        {providers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Providers
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {provider.type === "openai" ? (
                      <Sparkles className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {provider.type === "openai" ? "OpenAI" : "Anthropic"}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${provider.isActive ? "text-green-500" : "text-muted-foreground"}`}>
                    {provider.isActive ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {provider.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Provider Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {providers.length > 0 ? "Add Another Provider" : "Connect a Provider"}
          </h3>

          {/* Provider Type Selection */}
          <div className="grid gap-3 sm:grid-cols-2">
            {providerTypes.map((provider) => (
              <SelectableCard
                key={provider.type}
                icon={provider.icon}
                title={provider.name}
                description={provider.detail}
                isSelected={selectedType === provider.type || formData.type === provider.type}
                onClick={() => handleTypeSelect(provider.type)}
              />
            ))}
          </div>

          {/* Provider Name */}
          <FormField
            id="provider-name"
            label="Provider Name"
            type="text"
            placeholder="My OpenAI Key"
            icon={Key}
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
          />

          {/* Provider Slug (Auto-generated, read-only) */}
          <FormField
            id="provider-slug"
            label="Provider Slug"
            type="text"
            placeholder="my-openai-key"
            icon={Code2}
            value={formData.slug}
            readOnly
            iconRight={
              formData.slug ? (
                <span className="text-xs text-muted-foreground">API: provider-slug/model</span>
              ) : null
            }
          />

          {/* Provider Type (Hidden - used internally) */}
          <input type="hidden" value={formData.type} />

          {/* Base URL */}
          <FormField
            id="base-url"
            label="Base URL"
            type="text"
            placeholder="https://api.openai.com/v1"
            icon={Code2}
            value={formData.baseUrl}
            onChange={(e) => handleInputChange("baseUrl", e.target.value)}
          />

          {/* Model for Testing */}
          <FormField
            id="test-model"
            label="Test Model"
            type="text"
            placeholder={formData.type === "openai" ? "gpt-4o-mini" : "claude-3-haiku-20240307"}
            icon={Sparkles}
            value={formData.model || ""}
            onChange={(e) => handleInputChange("model", e.target.value)}
            hint="Enter a model to test the connection (e.g., gpt-4o-mini for OpenAI)"
          />

          {/* API Key */}
          <FormField
            id="api-key"
            label="Provider API Key"
            type={showPassword ? "text" : "password"}
            placeholder="sk-..."
            icon={Key}
            value={formData.apiKey}
            onChange={(e) => handleInputChange("apiKey", e.target.value)}
            iconRight={
              <button
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          />

          {/* Test Connection Button */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={!formData.apiKey || !formData.baseUrl || !formData.model || testStatus === "testing"}
              className="flex-1"
            >
              {testStatus === "testing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleAddProvider}
              disabled={!formData.name || !formData.slug || !formData.apiKey || !formData.baseUrl || !formData.model || isCreating || testStatus !== "success"}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Provider
                </>
              )}
            </Button>
          </div>

          {/* Test Result - Only show success as InfoBox, errors go to toast */}
          {testStatus === "success" && (
            <InfoBox variant="success" icon={Wifi} title="Connection successful">
              Successfully connected to the provider. You can now add this provider.
            </InfoBox>
          )}

          {/* Security Info */}
          <InfoBox variant="success" icon={ShieldCheck} title="Encrypted and never shared">
            Your keys are encrypted at rest using AES-256 and only decrypted in the secure enclave during active agent sessions.
          </InfoBox>
        </div>
      </StepContainer>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 px-12 py-4 z-50">
        <div className="mx-auto max-w-7xl">
          <StepNavigation
            onBack={onBack}
            onContinue={onContinue}
            disabled={!canContinue}
          />
        </div>
      </div>
    </>
  );
}
