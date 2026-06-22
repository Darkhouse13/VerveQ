import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_QUESTIONS,
  capImageQuestions,
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
});
