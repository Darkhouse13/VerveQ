import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("image upload control", () => {
  it("places a real transparent file input over the visible upload tile", () => {
    const source = read("components/ImageDropzone.tsx");

    expect(source).not.toContain("inputRef.current?.click()");
    expect(source).not.toContain('className="hidden"');
    expect(source).not.toContain('className="sr-only"');
    expect(source).toContain('className="absolute inset-0 h-full w-full cursor-pointer opacity-0"');
    expect(source).toContain('accept="image/*"');
    expect(source).toContain('aria-label="Add a question image"');
  });
});
