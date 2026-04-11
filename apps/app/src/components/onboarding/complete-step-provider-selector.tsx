import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Provider } from "@/stores/providerStore";

interface CompleteStepProviderSelectorProps {
  providers: Provider[];
  selectedProviderId?: string;
  onSelect: (providerId: string) => void;
}

export function CompleteStepProviderSelector({
  providers,
  selectedProviderId,
  onSelect,
}: CompleteStepProviderSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Provider for proxy setup</p>
      <Select value={selectedProviderId} onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select a provider" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.name} ({provider.slug})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
