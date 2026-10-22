/**
 * Design lockdown fixture — the FORBIDDEN shapes (VerveQ ONE P5.1).
 *
 * Every line below breaks the lockdown and carries an
 * `eslint-disable-next-line no-restricted-syntax`. eslint.config.js makes an
 * UNUSED disable directive an error in this directory, so if a selector ever
 * stops firing, its directive goes unused and `npm run lint` fails. Do not
 * "fix" these lines; they are the proof. See app/eslint.config.js
 * (DESIGN_LOCKDOWN) and eslint-fixtures/designLockdown/allowed.fixture.tsx.
 */
declare function cn(...inputs: unknown[]): string;
declare function cva(base: string, config?: unknown): unknown;

export function FiresInClassName() {
  return (
    <div>
      {/* eslint-disable-next-line no-restricted-syntax -- pixel font size */}
      <p className="font-mono text-[11px] uppercase">a</p>
      {/* eslint-disable-next-line no-restricted-syntax -- rem font size, responsive prefix */}
      <p className="md:text-[1.1rem]">b</p>
      {/* eslint-disable-next-line no-restricted-syntax -- arbitrary shadow */}
      <div className="shadow-[4px_4px_0_0_black]" />
      {/* eslint-disable-next-line no-restricted-syntax -- arbitrary radius */}
      <div className="rounded-[14px]" />
      {/* eslint-disable-next-line no-restricted-syntax -- per-corner arbitrary radius, important */}
      <div className="!rounded-tl-[3px]" />
      {/* eslint-disable-next-line no-restricted-syntax -- arbitrary letter-spacing */}
      <p className="tracking-[0.2em]">c</p>
      {/* eslint-disable-next-line no-restricted-syntax -- inside a template literal */}
      <p className={`p-2 ${"x"} text-[9px]`}>d</p>
    </div>
  );
}

export function FiresInBuilders(on: boolean) {
  return [
    // eslint-disable-next-line no-restricted-syntax -- a cn() argument outside JSX
    cn("p-2", on && "shadow-[0_0_8px_red]"),
    // eslint-disable-next-line no-restricted-syntax -- a cva() base
    cva("rounded-[6px] p-2"),
  ];
}
