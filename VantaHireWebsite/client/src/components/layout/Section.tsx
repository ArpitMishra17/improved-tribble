import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  /** Vertical padding variant */
  spacing?: "none" | "sm" | "md" | "lg" | "xl";
  /** HTML element to render */
  as?: "section" | "div" | "article" | "aside";
}

const spacingClasses = {
  none: "",
  sm: "py-4",
  md: "py-6",
  lg: "py-8",
  xl: "py-12",
};

/**
 * Section - Semantic section wrapper with consistent vertical spacing
 * Use for logical content groupings within a page
 */
export function Section({
  children,
  className,
  spacing = "md",
  as: Component = "section"
}: SectionProps) {
  return (
    <Component className={cn(spacingClasses[spacing], className)}>
      {children}
    </Component>
  );
}

export default Section;
