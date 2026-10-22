/**
 * THE WEEKEND player picker: the filters a manager set, kept across picker
 * opens for the rest of this tab's visit.
 *
 * The picker remounts per slot (its defaults re-arm by remount), so without
 * this a manager filling eight midfield and attack slots from the
 * Championship had to choose the league again on every open. The slot's own
 * position pre-filter is NOT remembered: each slot asks its own question.
 */
export interface PickerMemory {
  leagueFilter: number | null;
  clubFilter: string | null;
  /** Cheapest first instead of the default most-expensive first. */
  cheapestFirst: boolean;
  /** Only players whose price still lets the 13 be completed. */
  fitsOnly: boolean;
}

const DEFAULTS: PickerMemory = {
  leagueFilter: null,
  clubFilter: null,
  cheapestFirst: false,
  fitsOnly: true,
};

let memory: PickerMemory = { ...DEFAULTS };

export function readPickerMemory(): PickerMemory {
  return memory;
}

export function rememberPicker(patch: Partial<PickerMemory>): void {
  memory = { ...memory, ...patch };
}

/** Tests only: forget everything between cases. */
export function resetPickerMemory(): void {
  memory = { ...DEFAULTS };
}

/**
 * The most this pick may cost while the rest of the 13 can still be filled:
 * what's left, minus the cheapest possible price for every OTHER open slot.
 */
export function fitCap(remaining: number, openSlots: number, cheapestPrice: number): number {
  const others = Math.max(0, openSlots - 1);
  return Math.max(0, remaining - others * cheapestPrice);
}
