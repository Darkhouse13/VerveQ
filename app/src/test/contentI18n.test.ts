import { describe, expect, it } from "vitest";
import {
  composeLocalizedClues,
  composeLocalizedQuestion,
  localizedAnswerLabel,
  type CanonicalQuestion,
  type ClueSet,
} from "../../convex/lib/contentI18n";

const canonical: CanonicalQuestion = {
  question: "Which element has the symbol Fe?",
  options: ["Iron", "Gold", "Silver", "Lead"],
  explanation: "Fe is iron.",
};
// Display order differs from stored order (as orderAnswerOptions would produce).
const orderedValues = ["Silver", "Iron", "Lead", "Gold"];

describe("composeLocalizedQuestion", () => {
  it("is a no-op when there is no translation (en path)", () => {
    const r = composeLocalizedQuestion(canonical, orderedValues, null);
    expect(r.question).toBe(canonical.question);
    expect(r.options).toEqual(orderedValues);
    expect(r.optionValues).toEqual(orderedValues);
    expect(r.options).toEqual(r.optionValues); // label === value when untranslated
    expect(r.explanation).toBe("Fe is iron.");
  });

  it("overlays translated labels in display order while keeping canonical values", () => {
    const translation = {
      question: "Quel élément a le symbole Fe ?",
      // ALIGNED to canonical.options order: Iron, Gold, Silver, Lead
      options: ["Fer", "Or", "Argent", "Plomb"],
      explanation: "Fe, c'est le fer.",
    };
    const r = composeLocalizedQuestion(canonical, orderedValues, translation);
    expect(r.question).toBe("Quel élément a le symbole Fe ?");
    // optionValues stay canonical, in display order → what the client submits
    expect(r.optionValues).toEqual(["Silver", "Iron", "Lead", "Gold"]);
    // display labels follow the SAME display order, mapped to French
    expect(r.options).toEqual(["Argent", "Fer", "Plomb", "Or"]);
    expect(r.explanation).toBe("Fe, c'est le fer.");
  });

  it("ignores a translation whose option count mismatches (never desyncs)", () => {
    const bad = {
      question: "Quel élément ?",
      options: ["Fer", "Or"], // wrong length
      explanation: "x",
    };
    const r = composeLocalizedQuestion(canonical, orderedValues, bad);
    expect(r.question).toBe(canonical.question); // fell back to canonical
    expect(r.options).toEqual(r.optionValues);
    expect(r.options).toEqual(orderedValues);
  });

  it("falls back to canonical explanation when the translation omits it", () => {
    const r = composeLocalizedQuestion(canonical, orderedValues, {
      question: "Q",
      options: ["a", "b", "c", "d"],
    });
    expect(r.explanation).toBe("Fe is iron.");
  });
});

describe("localizedAnswerLabel", () => {
  // Display order (what a serve path returns), with aligned canonical values.
  const options = ["Argent", "Fer", "Plomb", "Or"];
  const optionValues = ["Silver", "Iron", "Lead", "Gold"];

  it("maps a canonical value (correctAnswer/pick) to its localized label", () => {
    expect(localizedAnswerLabel(options, optionValues, "Iron")).toBe("Fer");
    expect(localizedAnswerLabel(options, optionValues, "Gold")).toBe("Or");
  });

  it("falls back to the canonical value when not found (proper noun / free text)", () => {
    expect(localizedAnswerLabel(options, optionValues, "Lionel Messi")).toBe(
      "Lionel Messi",
    );
  });

  it("falls back to the canonical value when there are no options (logo text)", () => {
    expect(localizedAnswerLabel(undefined, undefined, "Nike")).toBe("Nike");
    expect(localizedAnswerLabel(null, optionValues, "Iron")).toBe("Iron");
  });

  it("is a no-op for an untranslated question (options === optionValues)", () => {
    expect(localizedAnswerLabel(optionValues, optionValues, "Iron")).toBe("Iron");
  });
});

describe("composeLocalizedClues", () => {
  const canonical: ClueSet = {
    clue1: "I won the Ballon d'Or seven times.",
    clue2: "I made my debut for FC Barcelona.",
    clue3: "I moved to Paris Saint-Germain in 2021.",
    clue4: "My name is Lionel.",
  };

  it("is a no-op when there is no translation (en path)", () => {
    const r = composeLocalizedClues(canonical, null);
    expect(r).toEqual(canonical);
  });

  it("overlays translated clue prose while keeping the same shape", () => {
    const translation: ClueSet = {
      clue1: "J'ai remporté le Ballon d'Or sept fois.",
      clue2: "J'ai débuté avec le FC Barcelona.",
      clue3: "J'ai rejoint le Paris Saint-Germain en 2021.",
      clue4: "Je m'appelle Lionel.",
    };
    const r = composeLocalizedClues(canonical, translation);
    expect(r).toEqual(translation);
  });

  it("falls back per-clue to canonical when a translated clue is empty", () => {
    const r = composeLocalizedClues(canonical, {
      clue1: "J'ai remporté le Ballon d'Or sept fois.",
      clue2: "",
      clue3: "J'ai rejoint le Paris Saint-Germain en 2021.",
      clue4: "",
    });
    expect(r.clue1).toBe("J'ai remporté le Ballon d'Or sept fois.");
    expect(r.clue2).toBe(canonical.clue2); // empty → canonical
    expect(r.clue3).toBe("J'ai rejoint le Paris Saint-Germain en 2021.");
    expect(r.clue4).toBe(canonical.clue4); // empty → canonical
  });
});
