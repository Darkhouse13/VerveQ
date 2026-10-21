import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Select — a styled native <select>: the platform picker on phones, the field
 * look of Input (48px, 16px text, hard border) and our own chevron.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <div className={cn("relative w-full", className)}>
    <select
      ref={ref}
      className="neo-border neo-shadow h-12 w-full cursor-pointer appearance-none rounded-lg bg-background pl-4 pr-11 font-body text-body text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground"
    />
  </div>
));
Select.displayName = "Select";

export { Select };
