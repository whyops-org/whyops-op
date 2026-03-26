import { Code2, Copy, Key, Rocket, User } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormField } from "./form-field";
import { InfoBox } from "./info-box";
import { SelectableCard } from "./selectable-card";
import { StepContainer } from "./step-container";
import { StepNavigation } from "./step-navigation";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { useProjectStore, type MasterKey } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";

// Map environment names to icons
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
  const {
    projects,
    currentProject,
    masterKeys,
    error,
    fetchProjects,
    createProject,
  } = useProjectStore();

  const { config, fetchConfig } = useConfigStore();
  const { fetchOnboardingProgress } = useAuthStore();

  const [projectName, setProjectName] = useState("");
  const [selectedEnvIndex, setSelectedEnvIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchProjects();
  }, [fetchConfig, fetchProjects]);

  // If user already has projects, use the first one
  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      setProjectName(projects[0].name);
    }
  }, [projects, currentProject]);

  // Show error as toast notification
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const environments = config?.environments || [];
  const selectedEnvironment = environments[selectedEnvIndex]?.name.toLowerCase() || "development";

  const handleGenerateApiKey = async () => {
    if (!projectName.trim()) return;

    setIsCreating(true);
    try {
      await createProject({
        name: projectName,
        description: `Workspace for ${selectedEnvironment} environment`,
      });
      // Refresh onboarding progress after creating project
      await fetchOnboardingProgress();
    } catch {
      // Error handled in store
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async (key: MasterKey) => {
    try {
      await navigator.clipboard.writeText(key.key);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const canContinue = masterKeys.length > 0;

  // Show loading state while config is loading
  if (!config) {
    return (
      <StepContainer>
        <div className="flex items-center justify-center p-12">
          <Spinner className="h-8 w-8 border-2 text-muted-foreground" />
        </div>
      </StepContainer>
    );
  }

  return (
    <>
      <StepContainer>
        {/* Project Name */}
        <FormField
          id="project-name"
          label="Project Name"
          placeholder="My AI Agent"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />

        {/* Environment Selection */}
        <div className="space-y-3">
          <label className="ml-1 text-sm font-medium text-muted-foreground">
            Environment
          </label>
          <div className="grid grid-cols-3 gap-3">
            {environments.map((env, index) => {
              const Icon = environmentIcons[env.name] || Code2;
              return (
                <SelectableCard
                  key={env.name}
                  icon={Icon}
                  title={env.displayName}
                  isSelected={selectedEnvIndex === index}
                  onClick={() => setSelectedEnvIndex(index)}
                  className="py-4"
                />
              );
            })}
          </div>
        </div>

        {/* Generate API Key Button */}
        {masterKeys.length === 0 && (
          <Button
            className="h-12 w-full text-base"
            size="lg"
            onClick={handleGenerateApiKey}
            disabled={!projectName.trim() || isCreating}
          >
            {isCreating ? (
              <>
                <Spinner className="mr-2 h-5 w-5 border-2" />
                Creating Workspace...
              </>
            ) : (
              <>
                <Key className="h-5 w-5 mr-2" />
                Generate API Key
              </>
            )}
          </Button>
        )}

        {/* API Key Display */}
        {masterKeys.length > 0 && (
          <InfoBox variant="warning" title="Security Warning" className="p-6">
            <p className="text-sm leading-relaxed mb-4">
              Save these keys somewhere safe. For security reasons,{" "}
              <span className="text-foreground font-semibold">
                you won&apos;t be able to view them again
              </span>{" "}
              after leaving this page.
            </p>

            {/* Key for selected environment */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                {masterKeys[selectedEnvIndex]?.name}
              </p>
              <div
                className="flex items-center gap-3 border border-border/50 bg-background px-4 py-3.5"
              >
                <div className="h-2 w-2 shrink-0 bg-primary" />
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono text-foreground/90 truncate block">
                    {masterKeys[selectedEnvIndex]?.prefix}...
                  </code>
                </div>
                <button
                  onClick={() => handleCopyKey(masterKeys[selectedEnvIndex])}
                  className="flex shrink-0 items-center gap-2 rounded-sm border border-border/50 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  {copiedKeyId === masterKeys[selectedEnvIndex]?.id ? (
                    <>
                      <Copy className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </InfoBox>
        )}
      </StepContainer>

      {/* Fixed Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background px-6 py-4 lg:px-12">
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
