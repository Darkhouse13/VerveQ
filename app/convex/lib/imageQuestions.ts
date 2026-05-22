// Shared image-question pool selection used by quiz + blitz session modules.
// Caps image questions per session and prevents two image questions in a row.

export const MAX_IMAGE_QUESTIONS = 2;

type ImageQuestion = { checksum: string; imageId?: unknown };

export function selectQuestionsWithImageCap<T extends { imageId?: unknown }>(
  candidates: T[],
  totalQuestions: number,
): T[] {
  const selected: T[] = [];
  let imageCount = 0;

  for (const question of candidates) {
    if (selected.length >= totalQuestions) break;
    if (question.imageId) {
      if (imageCount >= MAX_IMAGE_QUESTIONS) continue;
      imageCount += 1;
    }
    selected.push(question);
  }

  return selected;
}

export function pickQuestionPool<T extends ImageQuestion>(
  candidates: T[],
  usedChecksums: readonly string[],
): T[] {
  const usedSet = new Set(usedChecksums);
  const available = candidates.filter((q) => !usedSet.has(q.checksum));
  if (available.length === 0) return available;

  const usedImageCount = candidates.filter(
    (q) => usedSet.has(q.checksum) && q.imageId,
  ).length;

  const lastChecksum = usedChecksums[usedChecksums.length - 1];
  const lastWasImage = lastChecksum
    ? candidates.some((q) => q.checksum === lastChecksum && q.imageId)
    : false;

  if (usedImageCount >= MAX_IMAGE_QUESTIONS || lastWasImage) {
    return available.filter((q) => !q.imageId);
  }
  return available;
}
