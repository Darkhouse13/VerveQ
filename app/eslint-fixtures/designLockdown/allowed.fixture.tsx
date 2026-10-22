/**
 * Design lockdown fixture — the ALLOWED shapes. The named scales from
 * tailwind.config.ts, and arbitrary values the lockdown does not guard
 * (sizes, colors through tokens, `text-[length:inherit]`), must all pass.
 * See eslint-fixtures/designLockdown/fires.fixture.tsx for the forbidden ones.
 */
declare function cn(...inputs: unknown[]): string;

export function AllowedShapes(on: boolean) {
  return (
    <div className={cn("neo-border neo-shadow rounded-lg p-4", on && "rounded-full")}>
      <p className="font-mono text-eyebrow uppercase text-muted-foreground">eyebrow</p>
      <p className="text-meta md:text-body-sm">meta</p>
      <p className="font-heading text-title-lg tracking-brand">title</p>
      <p className="font-mono text-display tracking-code">ABCD</p>
      <span className="inline w-[72px] h-[3px] bg-[hsl(var(--lime))] text-[length:inherit]" />
      <div className="shadow-none rounded-sm z-overlay duration-ui" />
    </div>
  );
}
