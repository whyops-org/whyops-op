import { Badge } from "@/components/ui/badge";

interface ToolPageHeaderProps {
  title: string;
  description: string;
  tags?: string[];
}

export function ToolPageHeader({
  title,
  description,
  tags = [],
}: ToolPageHeaderProps) {
  return (
    <div className="border-b border-border/50 pb-5">
      <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
        {description}
      </p>
      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
