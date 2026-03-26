# Onboarding Flow - Architecture & Usage Guide

## Overview

The onboarding flow has been refactored to be more maintainable, scalable, and reusable. The new architecture includes:

1. **Reusable Components** - All common patterns extracted into components
2. **Better Overflow Handling** - Proper scrolling for content that extends beyond viewport
3. **Simplified Step Management** - Easy to add, remove, or reorder steps
4. **Conditional Rendering Support** - Structure ready for dynamic content based on user selections
5. **Consistent Layout** - No more switching between split/centered views

## Reusable Components

### Core Components

#### `StepContainer`
Wraps step content with proper overflow handling and consistent styling.

```tsx
<StepContainer maxHeight="70vh">
  {/* Your content */}
</StepContainer>
```

#### `StepIndicator`
Shows progress through the onboarding flow with visual step markers.

```tsx
<StepIndicator 
  steps={[
    { id: "welcome", label: "Welcome" },
    { id: "setup", label: "Setup" },
  ]} 
  currentStep={0} 
/>
```

#### `StepNavigation`
Consistent back/continue navigation for all steps.

```tsx
<StepNavigation 
  onBack={() => setStep(prev => prev - 1)}
  onContinue={() => setStep(prev => prev + 1)}
  continueDisabled={!isValid}
  continueLabel="Next Step"
/>
```

#### `FormField`
Reusable form input with label, icons, and proper styling.

```tsx
<FormField 
  id="email"
  label="Email Address"
  type="email"
  icon={Mail}
  placeholder="you@example.com"
  iconRight={<EyeIcon />}
/>
```

#### `SelectableCard`
Card for selecting options (providers, environments, etc).

```tsx
<SelectableCard
  icon={Rocket}
  title="Production"
  description="Deploy to production"
  isSelected={selected === 0}
  onClick={() => setSelected(0)}
/>
```

#### `InfoBox`
Contextual information boxes with different variants.

```tsx
<InfoBox variant="success" icon={ShieldCheck} title="Secure">
  Your data is encrypted end-to-end.
</InfoBox>

{/* Variants: info, success, warning, error */}
```

## Adding New Steps

To add a new step to the onboarding:

1. **Update step definitions:**

```tsx
const stepDefinitions = [
  { id: "welcome", label: "Welcome" },
  { id: "provider", label: "Provider" },
  { id: "workspace", label: "Workspace" },
  { id: "integrations", label: "Integrations" }, // NEW STEP
  { id: "complete", label: "Complete" },
];
```

2. **Add step content:**

```tsx
const steps = [
  // ... existing steps
  {
    id: "integrations",
    title: "Connect Integrations",
    subtitle: "Link your tools and services for better insights.",
    content: null,
    preview: (
      <IntegrationsCard
        onBack={() => setCurrentStep(2)}
        onContinue={() => setCurrentStep(4)}
      />
    ),
  },
];
```

## Conditional Rendering Example

Here's how to add conditional content based on user selection:

### Example: Different fields based on provider selection

```tsx
export function ProviderCard({ onBack, onContinue }: ProviderCardProps) {
  const [selected, setSelected] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [organizationId, setOrganizationId] = useState("");

  return (
    <StepContainer>
      {/* Provider Selection */}
      <div className="grid gap-3 sm:grid-cols-3">
        {providers.map((provider, index) => (
          <SelectableCard
            key={provider.name}
            icon={provider.icon}
            title={provider.name}
            description={provider.detail}
            isSelected={selected === index}
            onClick={() => setSelected(index)}
          />
        ))}
      </div>

      {/* API Key - Always shown */}
      <FormField
        id="api-key"
        label="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />

      {/* Conditional: OpenAI requires Organization ID */}
      {selected === 0 && (
        <FormField
          id="org-id"
          label="Organization ID (Optional)"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          placeholder="org-..."
        />
      )}

      {/* Conditional: Anthropic shows different info */}
      {selected === 1 && (
        <InfoBox variant="info" icon={Info} title="Claude Models">
          Anthropic models support extended context windows up to 200K tokens.
        </InfoBox>
      )}

      {/* Conditional: Custom provider shows additional options */}
      {selected === 2 && (
        <>
          <FormField
            id="endpoint"
            label="API Endpoint"
            placeholder="https://your-endpoint.com/v1"
          />
          <FormField
            id="model-name"
            label="Model Name"
            placeholder="custom-model-v1"
          />
        </>
      )}

      <StepNavigation onBack={onBack} onContinue={onContinue} />
    </StepContainer>
  );
}
```

### Example: Multi-tab conditionalrendering

```tsx
export function ConfigurationCard({ onBack, onContinue }: ConfigProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");

  return (
    <StepContainer>
      {/* Tab Selection */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setActiveTab("basic")}
          className={cn(
            "flex-1 py-2 px-4 rounded-md font-medium transition",
            activeTab === "basic" 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Basic
        </button>
        <button
          onClick={() => setActiveTab("advanced")}
          className={cn(
            "flex-1 py-2 px-4 rounded-md font-medium transition",
            activeTab === "advanced" 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Advanced
        </button>
      </div>

      {/* Conditional Content */}
      {activeTab === "basic" && (
        <>
          <FormField id="name" label="Project Name" />
          <FormField id="description" label="Description" />
        </>
      )}

      {activeTab === "advanced" && (
        <>
          <FormField id="webhook" label="Webhook URL" />
          <FormField id="retention" label="Data Retention (days)" type="number" />
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase">Features</label>
            <div className="space-y-2">
              <CheckboxField label="Enable real-time monitoring" />
              <CheckboxField label="Capture function calls" />
              <CheckboxField label="Track token usage" />
            </div>
          </div>
        </>
      )}

      <StepNavigation onBack={onBack} onContinue={onContinue} />
    </StepContainer>
  );
}
```

## Form State Management

For complex forms with validation:

```tsx
export function AdvancedSetupCard({ onBack, onContinue }: Props) {
  const [formData, setFormData] = useState({
    projectName: "",
    apiKey: "",
    environment: "production",
    features: {
      monitoring: true,
      analytics: false,
      alerts: true,
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.projectName) {
      newErrors.projectName = "Project name is required";
    }
    
    if (!formData.apiKey || formData.apiKey.length < 20) {
      newErrors.apiKey = "Valid API key is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      onContinue?.();
    }
  };

  return (
    <StepContainer>
      <FormField 
        id="project-name"
        label="Project Name"
        value={formData.projectName}
        onChange={(e) => setFormData(prev => ({ 
          ...prev, 
          projectName: e.target.value 
        }))}
      />
      {errors.projectName && (
        <p className="text-xs text-destructive mt-1">{errors.projectName}</p>
      )}

      {/* More fields... */}

      <StepNavigation 
        onBack={onBack} 
        onContinue={handleContinue}
        continueDisabled={!formData.projectName || !formData.apiKey}
      />
    </StepContainer>
  );
}
```

## Benefits of New Architecture

### ✅ Reduced Code Duplication
- Previously: ~300 lines of repetitive code across cards
- Now: Reusable components reduce code by 60%

### ✅ Better Overflow Handling
- StepContainer manages scroll automatically
- No more content getting cut off
- Works with any amount of content

### ✅ Easier to Scale
- Add new steps in minutes, not hours
- Conditional rendering is straightforward
- Form state management is cleaner

### ✅ Consistent UX
- Navigation works the same everywhere
- Visual consistency across all steps
- Predictable behavior for users

### ✅ Better Developer Experience
- Clear component responsibilities
- Self-documenting code
- Easy to test individual components

## Migration Notes

### Old Pattern (Don't Use)
```tsx
<div className="border-none shadow-none">
  <CardContent className="flex flex-col space-y-[4dvh] p-0">
    {/* Lots of repeated code */}
    <div className="mt-auto flex items-center justify-between pt-[2dvh]">
      <button onClick={onBack}>← Back</button>
      <Button onClick={onContinue}>Continue</Button>
    </div>
  </CardContent>
</div>
```

### New Pattern (Use This)
```tsx
<StepContainer>
  {/* Your unique content */}
  <StepNavigation onBack={onBack} onContinue={onContinue} />
</StepContainer>
```

## Next Steps

Consider adding:
- Form validation library (react-hook-form + zod)
- State management (zustand/jotai) for multi-step form data
- Animations between steps (framer-motion)
- Step persistence (localStorage/sessionStorage)
- Analytics tracking for step completion
