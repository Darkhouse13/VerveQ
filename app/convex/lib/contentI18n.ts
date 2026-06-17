import type { QueryCtx } from "../_generated/server";

/**
 * Phase 4 content i18n — "display-translate, grade-canonical".
 *
 * Quiz grading compares the SUBMITTED option text to the canonical English
 * `correctAnswer` server-side. So we render translated option labels but the
 * client submits the canonical English `optionValues[i]` — grading and the
 * checksum (English-derived identity) are never touched. See
 * docs/I18N_CONTENT_DESIGN.md.
 */

export interface CanonicalQuestion {
  question: string;
  /** Canonical options in their stored (unordered) order. */
  options: string[];
  explanation?: string;
}

export interface QuestionTranslation {
  question: string;
  /** Translated options, ALIGNED to the canonical (unordered) options order. */
  options: string[];
  explanation?: string;
}

export interface LocalizedServedQuestion {
  /** Display question (translated when available, else canonical). */
  question: string;
  /** Display options in display order (what the user sees). */
  options: string[];
  /** Canonical English options in the SAME order — what the client submits. */
  optionValues: string[];
  /** Display explanation (translated when available, else canonical). */
  explanation?: string;
}

/**
 * Pure overlay. `orderedValues` is the canonical option list already ordered for
 * display (e.g. via lib/answerOptions.orderAnswerOptions). When a valid aligned
 * translation is supplied, each ordered canonical value is mapped to its
 * translated label; `optionValues` always stays canonical so grading is
 * unaffected. A length mismatch is treated as "no translation" so a bad row can
 * never desync label↔value (which would mis-submit answers).
 */
export function composeLocalizedQuestion(
  canonical: CanonicalQuestion,
  orderedValues: string[],
  translation: QuestionTranslation | null,
): LocalizedServedQuestion {
  if (!translation || translation.options.length !== canonical.options.length) {
    return {
      question: canonical.question,
      options: orderedValues,
      optionValues: orderedValues,
      explanation: canonical.explanation,
    };
  }
  const byCanonical = new Map(
    canonical.options.map((opt, i) => [opt, translation.options[i]] as const),
  );
  return {
    question: translation.question,
    options: orderedValues.map((v) => byCanonical.get(v) ?? v),
    optionValues: orderedValues,
    explanation: translation.explanation ?? canonical.explanation,
  };
}

/**
 * Fetch the display translation for a question, or null for English / missing /
 * not-yet-translated (callers then serve canonical English).
 */
export async function fetchQuestionTranslation(
  ctx: QueryCtx,
  checksum: string,
  locale: string | undefined | null,
): Promise<QuestionTranslation | null> {
  if (!locale || locale === "en") return null;
  const row = await ctx.db
    .query("quizQuestionTranslations")
    .withIndex("by_checksum_locale", (q) =>
      q.eq("checksum", checksum).eq("locale", locale),
    )
    .first();
  if (!row) return null;
  return {
    question: row.question,
    options: row.options,
    explanation: row.explanation,
  };
}
