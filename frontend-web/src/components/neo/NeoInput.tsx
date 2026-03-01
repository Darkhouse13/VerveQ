import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const NeoInput = forwardRef<HTMLInputElement, NeoInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "neo-border neo-shadow rounded-lg px-4 py-3 font-body text-base bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full transition-all",
        className
      )}
      {...props}
    />
  )
);
NeoInput.displayName = "NeoInput";

export { NeoInput };
