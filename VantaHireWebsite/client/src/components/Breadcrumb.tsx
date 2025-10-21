import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path?: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const [, setLocation] = useLocation();

  return (
    <nav className={`flex items-center gap-2 text-sm ${className}`} aria-label="Breadcrumb">
      {/* Home icon as first item */}
      <button
        onClick={() => setLocation("/")}
        className="text-white/60 hover:text-white transition-colors"
        aria-label="Go to home"
      >
        <Home className="h-4 w-4" />
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isActive = item.active || isLast;

        return (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-white/40" />

            {item.path && !isActive ? (
              <button
                onClick={() => setLocation(item.path!)}
                className="text-white/60 hover:text-white transition-colors hover:underline"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={`${
                  isActive
                    ? "text-white font-medium"
                    : "text-white/60"
                }`}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Convenience component for common breadcrumb patterns
export function ApplicationBreadcrumb({ jobTitle }: { jobTitle: string }) {
  return (
    <Breadcrumb
      items={[
        { label: "Dashboard", path: "/recruiter-dashboard" },
        { label: "Jobs", path: "/jobs" },
        { label: jobTitle, active: true },
      ]}
    />
  );
}

export function JobPostBreadcrumb() {
  return (
    <Breadcrumb
      items={[
        { label: "Dashboard", path: "/recruiter-dashboard" },
        { label: "Post Job", active: true },
      ]}
    />
  );
}
