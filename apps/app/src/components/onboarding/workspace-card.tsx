import { Code2, Key, Rocket, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore, type MasterKey } from "@/stores/projectStore";
import { FormField } from "./form-field";
import { OnboardingErrorState } from "./onboarding-error-state";
import { OnboardingViewportFooter } from "./onboarding-viewport-footer";
import { SelectableCard } from "./selectable-card";
import { StepContainer } from "./step-container";
import { StepNavigation } from "./step-navigation";
import { WorkspaceApiKeyPanel } from "./workspace-api-key-panel";

const environmentIcons: Record<string, typeof Rocket> = {
  PRODUCTION: Rocket,
  STAGING: User,
  DEVELOPMENT: Code2,
};

interface WorkspaceCardProps {
  onBack?: () => void;
  onContinue?: () => void;
}
export function WorkspaceCard({ onBack, onContinue }: WorkspaceCardProps) {
  const { projects, currentProject, currentEnvironments, masterKeys, error, fetchProjects, createProject, createApiKey } =
    useProjectStore();
  const { config, fetchConfig, error: configError } = useConfigStore();
  const { fetchOnboardingProgress } = useAuthStore();
  const [projectName, setProjectName] = useState("");
  const [selectedEnvIndex, setSelectedEnvIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchProjects();
  }, [fetchConfig, fetchProjects]);

  useEffect(() => {
    if (currentProject?.name) {
      setProjectName(currentProject.name);
      return;
    }
    if (projects.length > 0) {
      setProjectName(projects[0].name);
    }
  }, [projects, currentProject]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const environments = config?.environments || [];
  const selectedEnvironment = environments[selectedEnvIndex]?.name.toLowerCase() || "development";
  const selectedEnvironmentConfig = environments[selectedEnvIndex];
  const selectedProjectEnvironment =
    currentEnvironments.find((environment) => environment.name === selectedEnvironmentConfig?.name) || null;
  const selectedKey = selectedProjectEnvironment ? masterKeys.find((key) => key.environmentId === selectedProjectEnvironment.id) || null : null;
  const hasUsableSelectedKey = Boolean(selectedKey?.key || selectedKey?.canReveal);
  const needsSelectedEnvironmentKey = !hasUsableSelectedKey;
  const generateLabel = currentProject ? "Generate API Key" : "Create Workspace and Key";

  const handleGenerateApiKey = async () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    try {
      if (currentProject && !selectedProjectEnvironment) {
        toast.error("No active environment is available for this workspace.");
        return;
      }
      if (currentProject && selectedProjectEnvironment) {
        await createApiKey({
          projectId: currentProject.id,
          environmentId: selectedProjectEnvironment.id,
          environmentName: selectedProjectEnvironment.name,
        });
      } else {
        await createProject({
          name: projectName,
          description: `Workspace for ${selectedEnvironment} environment`,
        });
      }
      await fetchOnboardingProgress();
    } catch {
      // Store handles request errors.
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async (key: MasterKey) => {
    try {
      const plainKey = key.key
        ? key.key
        : key.canReveal
          ? (
              await apiClient.get<{ apiKey: string }>(`/api/api-keys/${key.id}/unmasked`)
            ).data.apiKey
          : "";
      if (!plainKey) {
        toast.error("This API key can no longer be revealed. Create a fresh key instead.");
        return;
      }
      await navigator.clipboard.writeText(plainKey);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      toast.error("Failed to copy API key.");
    }
  };
  if (!config && configError) {
    return <OnboardingErrorState title="Couldn’t load workspace setup" message={configError} onRetry={() => { fetchConfig(); fetchProjects(); }} />;
  }
  if (!config && error && !projects.length && !currentProject) {
    return <OnboardingErrorState title="Couldn’t load workspace" message={error} onRetry={fetchProjects} />;
  }
  if (!config) {
    return (
      <StepContainer bodyClassName="justify-center">
        <div className="flex items-center justify-center p-12">
          <Spinner className="h-8 w-8 border-2 text-muted-foreground" />
        </div>
      </StepContainer>
    );
  }

  return (
    <>
      <StepContainer bodyClassName="justify-between">
        <div className="space-y-6">
          <FormField
            id="project-name"
            label="Project Name"
            placeholder="My AI Agent"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <div className="space-y-3">
            <label className="ml-1 text-sm font-medium text-muted-foreground">
              Environment
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {environments.map((env, index) => {
                const Icon = environmentIcons[env.name] || Code2;
                return (
                  <SelectableCard
                    key={env.name}
                    icon={Icon}
                    title={env.displayName}
                    isSelected={selectedEnvIndex === index}
                    onClick={() => setSelectedEnvIndex(index)}
                    className="min-h-[112px] justify-between rounded-md py-4"
                  />
                );
              })}
            </div>
          </div>
          {needsSelectedEnvironmentKey && (
            <Button
              className="h-12 w-full text-base"
              size="lg"
              onClick={handleGenerateApiKey}
              disabled={!projectName.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Spinner className="mr-2 h-5 w-5 border-2" />
                  {currentProject ? "Generating API Key..." : "Creating Workspace..."}
                </>
              ) : (
                <>
                  <Key className="h-5 w-5 mr-2" />
                  {generateLabel}
                </>
              )}
            </Button>
          )}
        </div>
        {selectedKey && hasUsableSelectedKey ? (
          <WorkspaceApiKeyPanel copiedKeyId={copiedKeyId} selectedKey={selectedKey} onCopy={handleCopyKey} />
        ) : currentProject ? (
          <p className="text-sm leading-relaxed text-muted-foreground">Generate a key for the selected environment to continue with a real onboarding snippet.</p>
        ) : null}
      </StepContainer>
      <OnboardingViewportFooter>
        <StepNavigation onBack={onBack} onContinue={onContinue} disabled={!hasUsableSelectedKey} />
      </OnboardingViewportFooter>
    </>
  );
}
