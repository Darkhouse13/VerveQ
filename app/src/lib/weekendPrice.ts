/**
 * WEEKEND prices with their unit. Every budget number a visitor sees carries
 * the unit (owner copy rule: cold traffic gets plain words, and numbers carry
 * units), in the register fantasy players already know — "£91.0m", "£7.5m".
 * One decimal, the UI language's decimal mark; the unit's wording and
 * placement live in the `weekend.priceAmount` locale key.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/** 91 → "91.0" (en) · "91,0" (fr/es). */
export function formatPriceNumber(amount: number, language: string): string {
  try {
    return new Intl.NumberFormat(language, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return amount.toFixed(1);
  }
}

/** A formatter for the current UI language: 91 → "£91.0m" (en) · "91,0 M£" (fr/es). */
export function usePriceFormat(): (amount: number) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (amount: number) =>
      t("weekend.priceAmount", {
        defaultValue: "£{{amount}}m",
        amount: formatPriceNumber(amount, i18n.language),
      }),
    [t, i18n.language],
  );
}
