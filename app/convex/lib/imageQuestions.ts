// Shared image-question handling used by every question-serving mode (quiz,
// blitz, daily, async duels, live matches, and the challenge arena). Caps image
// questions per session/round and prevents two image questions in a row.
//
// "Image" means a question carrying EITHER a Convex-storage image (imageId) OR a
// URL image (imageUrl) — `questionHasImage` is the single source of truth so the
// cap applies uniformly across all sports and subjects, not just imageId pools.

export const MAX_IMAGE_QUESTIONS = 2;

type ImageFields = { imageId?: unknown; imageUrl?: unknown };
type ImageQuestion = ImageFields & { checksum: string };

export function questionHasImage(question: ImageFields): boolean {
  return !!question.imageId || !!question.imageUrl;
}

export function selectQuestionsWithImageCap<T extends ImageFields>(
  candidates: T[],
  totalQuestions: number,
): T[] {
  const selected: T[] = [];
  let imageCount = 0;

  for (const question of candidates) {
    if (selected.length >= totalQuestions) break;
    if (questionHasImage(question)) {
      if (imageCount >= MAX_IMAGE_QUESTIONS) continue;
      imageCount += 1;
    }
    selected.push(question);
  }

  return selected;
}

// Pick exactly `limit` questions (when the pool allows) holding at most
// `maxImages` image questions: take the image budget first, fill the rest with
// text, then backfill from leftover images only if the pool is too text-poor to
// reach `limit`. Caller controls ordering (e.g. a seeded shuffle afterwards).
// Used for batch selection where the round must be a fixed length (the arena).
export function capImageQuestions<T extends ImageFields>(
  candidates: T[],
  limit: number,
  maxImages: number = MAX_IMAGE_QUESTIONS,
): T[] {
  const images = candidates.filter((q) => questionHasImage(q));
  const text = candidates.filter((q) => !questionHasImage(q));
  const selected = [
    ...images.slice(0, maxImages),
    ...text.slice(0, Math.max(0, limit - Math.min(images.length, maxImages))),
  ];
  // Text-poor pool: backfill from the remaining images so the round still fills.
  if (selected.length < limit) {
    for (const image of images.slice(maxImages)) {
      if (selected.length >= limit) break;
      selected.push(image);
    }
  }
  return selected.slice(0, limit);
}

// Plan a serving sequence up front: repeatedly draw a random question through
// `pickQuestionPool`, so the resulting order obeys the same image cap and
// no-two-images-in-a-row rules the per-fetch path enforces. Lets session
// creation collect the candidate pool ONCE and serve each question later with
// a single indexed read instead of re-collecting the whole sport+difficulty
// slice per question (~230ms per fetch on the live pools).
export function planQuestionSequence<T extends ImageQuestion>(
  candidates: T[],
  count: number,
): string[] {
  const planned: string[] = [];
  while (planned.length < count) {
    const pool = pickQuestionPool(candidates, planned);
    if (pool.length === 0) break;
    planned.push(pool[Math.floor(Math.random() * pool.length)].checksum);
  }
  return planned;
}

export function pickQuestionPool<T extends ImageQuestion>(
  candidates: T[],
  usedChecksums: readonly string[],
): T[] {
  const usedSet = new Set(usedChecksums);
  const available = candidates.filter((q) => !usedSet.has(q.checksum));
  if (available.length === 0) return available;

  const usedImageCount = candidates.filter(
    (q) => usedSet.has(q.checksum) && questionHasImage(q),
  ).length;

  const lastChecksum = usedChecksums[usedChecksums.length - 1];
  const lastWasImage = lastChecksum
    ? candidates.some((q) => q.checksum === lastChecksum && questionHasImage(q))
    : false;

  if (usedImageCount >= MAX_IMAGE_QUESTIONS || lastWasImage) {
    return available.filter((q) => !questionHasImage(q));
  }
  return available;
}
