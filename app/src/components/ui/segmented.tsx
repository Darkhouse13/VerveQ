import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  block?: boolean;
  className?: string;
}

/**
 * Segmented — a row of 44px tabs for switching one view. role=tablist/tab with
 * aria-selected; arrow keys move between segments (roving tabindex).
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  "aria-label": label,
  block = false,
  className,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("neo-border inline-flex gap-1 rounded-lg bg-card p-1", block && "flex w-full", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-11 flex-1 cursor-pointer rounded-md px-4 font-heading text-body-sm font-bold transition-colors duration-ui",
              selected ? "bg-primary text-primary-foreground" : "bg-transparent text-foreground hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { Segmented };
