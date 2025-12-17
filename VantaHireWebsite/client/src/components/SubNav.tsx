import { cn } from "@/lib/utils";

export interface SubNavItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SubNavProps {
  items: SubNavItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function SubNav({ items, activeId, onChange, className }: SubNavProps) {
  return (
    <div className={cn("border-b border-border bg-white", className)}>
      <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Sub navigation">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              activeId === item.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
            aria-current={activeId === item.id ? "page" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={cn(
                  "px-2 py-0.5 text-xs rounded-full",
                  activeId === item.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
