import { cn } from "@/lib/utils";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Max width variant */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeClasses = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

/**
 * Container - Consistent container wrapper
 * Replaces the 41+ instances of `container mx-auto px-4`
 */
export function Container({
  children,
  className,
  size = "xl"
}: ContainerProps) {
  return (
    <div className={cn(
      "mx-auto w-full px-4 sm:px-6 lg:px-8",
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}

export default Container;
