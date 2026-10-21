import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's built-in font sizes. Without this, a
 * named size from the VerveQ ONE type scale (`text-body-sm`, `text-eyebrow`…)
 * is read as a text COLOR, and `cn("text-body", "text-primary-foreground")`
 * silently drops one of the two.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["eyebrow", "meta", "body-sm", "body", "title-sm", "title", "title-lg", "display", "score"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
