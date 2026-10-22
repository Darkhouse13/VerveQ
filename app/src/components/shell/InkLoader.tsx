/**
 * The app's one loading state: two quiet card shapes on the ink ground, drawn
 * exactly like the boot skeleton in index.html. Every wait between first paint
 * and the first real screen (bundle, lazy screens, sign-in) shows this, so a
 * load reads as one screen filling in rather than a run of different ones.
 *
 * It covers the whole viewport (fixed), not the in-flow app frame: in flow it
 * would be a phone-width column on a wide screen, and on the homepage it would
 * leave the static SEO text showing around it.
 */
import { useTranslation } from "react-i18next";

export function InkLoader() {
  // No suspense: this IS a loading fallback, it must never suspend itself.
  const { t } = useTranslation("shell", { useSuspense: false });
  return (
    <div
      className="theme-ink fixed inset-0 overflow-hidden bg-background px-5 pt-[72px]"
      role="status"
      aria-label={t("common.loading", { defaultValue: "Loading" })}
    >
      <div className="mx-auto flex max-w-[420px] flex-col gap-4">
        <div className="h-[36vh] max-h-[300px] rounded-lg border-2 border-border/10 bg-card animate-pulse" />
        <div className="h-[36vh] max-h-[300px] rounded-lg border-2 border-border/10 bg-card animate-pulse" />
      </div>
    </div>
  );
}
