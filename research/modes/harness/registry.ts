import { calibSecret } from '../candidates/calibSecret.ts';
import { calibSkill } from '../candidates/calibSkill.ts';
import { calibTrivia } from '../candidates/calibTrivia.ts';
import type { AnyCandidate } from './types.ts';

/** Every candidate the runner can be pointed at, keyed by its id. */
export const CANDIDATES: readonly AnyCandidate[] = [calibTrivia, calibSkill, calibSecret];

export function getCandidate(id: string): AnyCandidate {
  const found = CANDIDATES.find((candidate) => candidate.id === id);
  if (!found) {
    const known = CANDIDATES.map((candidate) => candidate.id).join(', ');
    throw new Error(`unknown candidate "${id}". Registered: ${known}`);
  }
  return found;
}
