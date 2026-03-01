import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const neoButtonVariants = cva(
  "neo-border font-heading font-bold uppercase tracking-wide transition-all duration-100 active:neo-shadow-pressed cursor-pointer select-none inline-flex items-center justify-center gap-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground neo-shadow hover:brightness-110",
        secondary: "bg-background text-foreground neo-shadow hover:bg-muted",
        outline: "bg-transparent text-foreground neo-shadow hover:bg-muted",
        success: "bg-success text-success-foreground neo-shadow hover:brightness-110",
        danger: "bg-destructive text-destructive-foreground neo-shadow hover:brightness-110",
        accent: "bg-accent text-accent-foreground neo-shadow hover:brightness-110",
        blue: "bg-electric-blue text-electric-blue-foreground neo-shadow hover:brightness-110",
        pink: "bg-hot-pink text-hot-pink-foreground neo-shadow hover:brightness-110",
        ghost: "border-0 shadow-none text-foreground hover:bg-muted",
      },
      size: {
        sm: "px-3 py-1.5 text-xs rounded-md",
        md: "px-5 py-2.5 text-sm rounded-lg",
        lg: "px-6 py-3.5 text-base rounded-lg",
        xl: "px-8 py-4 text-lg rounded-lg",
        full: "px-6 py-3.5 text-base rounded-lg w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface NeoButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof neoButtonVariants> {}

const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(neoButtonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
NeoButton.displayName = "NeoButton";

export { NeoButton, neoButtonVariants };
