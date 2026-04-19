import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { InputHTMLAttributes, ReactNode } from "react";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'icon'> {
  label: string;
  id: string;
  icon?: LucideIcon;
  iconRight?: ReactNode;
  containerClassName?: string;
  hint?: string;
}

export function FormField({
  label,
  id,
  icon: Icon,
  iconRight,
  containerClassName,
  hint,
  className,
  ...inputProps
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2.5", containerClassName)}>
      <Label htmlFor={id} className="ml-1">
        {label}
      </Label>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <Input
          id={id}
          className={cn(
            "bg-card border-border h-12 rounded-md focus-visible:ring-primary/20 focus-visible:border-primary/50 text-base",
            Icon && "pl-12",
            iconRight && "pr-12",
            className
          )}
          {...inputProps}
        />
        {iconRight && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {iconRight}
          </div>
        )}
      </div>
      {hint && (
        <p className="ml-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
