import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description/subtitle */
  description?: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Optional action buttons (rendered on the right) */
  actions?: React.ReactNode;
  /** Optional breadcrumb navigation */
  breadcrumbs?: BreadcrumbItem[];
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * PageHeader - Consistent page header with icon, title, description, actions, and breadcrumbs
 *
 * Replaces the 40+ variations of page header patterns across the codebase:
 * - `<div className="flex items-center gap-3 mb-8">...`
 * - `<div className="flex items-center gap-3 pt-8 mb-4">...`
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   icon={Users}
 *   title="Applications"
 *   description="Manage job applications"
 *   breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Applications" }]}
 *   actions={<Button>Export</Button>}
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  className
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground truncate">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
