import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Text fields. 16px text (anything smaller makes iOS zoom the page on focus),
 * 48px tall, the hard border and shadow. Focus uses the global :focus-visible
 * ring from index.css, so there is no per-field focus style here.
 */
const fieldClasses =
  "neo-border neo-shadow w-full rounded-lg bg-background px-4 font-body text-body text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldClasses, "h-12 py-3", className)} {...props} />
));
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldClasses, "min-h-24 py-3", className)} {...props} />
));
Textarea.displayName = "Textarea";

export { Input, Textarea };
