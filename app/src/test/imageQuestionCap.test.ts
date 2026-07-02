import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_QUESTIONS,
  capImageQuestions,
  planQuestionSequence,
  questionHasImage,
  selectQuestionsWithImageCap,
} from "../../convex/lib/imageQuestions";

// The shared image cap is what every question-serving mode relies on. These lock
// the two behaviours the cap must guarantee uniformly across all sports/subjects:
// (1) both imageId and imageUrl count as "image", and (2) no selection exceeds
// MAX_IMAGE_QUESTIONS images while still filling the requested length.
describe("shared image question cap", () => {
  it("treats both imageId and imageUrl questions as images", () => {
    expect(questionHasImage({ imageId: "abc" })).toBe(true);
    expect(questionHasImage({ imageUrl: "https://x/y.png" })).toBe(true);
    expect(questionHasImage({})).toBe(false);
    expect(questionHasImage({ imageId: undefined, imageUrl: undefined })).toBe(false);
  });

  it("selectQuestionsWithImageCap caps imageUrl-only images, not just imageId", () => {
    const allImageUrl = Array.from({ length: 10 }, (_, i) => ({
      checksum: `c${i}`,
      imageUrl: `https://x/${i}.png`,
    }));
    expect(selectQuestionsWithImageCap(allImageUrl, 10)).toHaveLength(
      MAX_IMAGE_QUESTIONS,
    );
  });

  it("capImageQuestions fills the limit with at most MAX images when text is plentiful", () => {
    const images = Array.from({ length: 8 }, (_, i) => ({
      checksum: `i${i}`,
      imageId: `id${i}` as string | undefined,
    }));
    const text = Array.from({ length: 8 }, (_, i) => ({
      checksum: `t${i}`,
      imageId: undefined as string | undefined,
    }));
    const picked = capImageQuestions([...images, ...text], 10);
    expect(picked).toHaveLength(10);
    expect(picked.filter(questionHasImage)).toHaveLength(MAX_IMAGE_QUESTIONS);
  });

  it("capImageQuestions backfills images only when the pool is too text-poor to fill", () => {
    const images = Array.from({ length: 9 }, (_, i) => ({
      checksum: `i${i}`,
      imageId: `id${i}` as string | undefined,
    }));
    const text = Array.from({ length: 2 }, (_, i) => ({
      checksum: `t${i}`,
      imageId: undefined as string | undefined,
    }));
    const picked = capImageQuestions([...images, ...text], 6);
    expect(picked).toHaveLength(6);
    // 2 text available + 2 capped images = 4, then backfill 2 more images → 4 images.
    expect(picked.filter(questionHasImage)).toHaveLength(4);
  });

  // planQuestionSequence backs the pre-planned quiz/blitz sessions (one pool
  // collect at session create, indexed reads per question). It must obey the
  // same rules as the per-fetch pickQuestionPool path it replaces.
  it("planQuestionSequence plans unique questions honoring the image cap and no-consecutive-images rule", () => {
    const images = Array.from({ length: 5 }, (_, i) => ({
      checksum: `img${i}`,
      imageId: `id${i}`,
    }));
    const text = Array.from({ length: 20 }, (_, i) => ({
      checksum: `txt${i}`,
      imageId: undefined as string | undefined,
    }));
    const pool = [...images, ...text];
    const byChecksum = new Map(pool.map((q) => [q.checksum, q]));

    const planned = planQuestionSequence(pool, 10);
    expect(planned).toHaveLength(10);
    expect(new Set(planned).size).toBe(10);
    const isImage = (c: string) => questionHasImage(byChecksum.get(c)!);
    expect(planned.filter(isImage).length).toBeLessThanOrEqual(
      MAX_IMAGE_QUESTIONS,
    );
    for (let i = 1; i < planned.length; i++) {
      expect(isImage(planned[i - 1]) && isImage(planned[i])).toBe(false);
    }
  });

  it("planQuestionSequence stops at pool exhaustion instead of repeating", () => {
    const pool = Array.from({ length: 4 }, (_, i) => ({
      checksum: `t${i}`,
      imageId: undefined as string | undefined,
    }));
    const planned = planQuestionSequence(pool, 10);
    expect(planned).toHaveLength(4);
    expect(new Set(planned).size).toBe(4);
  });
});
