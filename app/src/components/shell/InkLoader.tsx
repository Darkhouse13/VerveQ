/**
 * Loading state on the ink ground: two quiet card shapes, the same as the
 * boot skeleton in index.html, so the first seconds on a reel-traffic route
 * stay ink instead of flashing a cream page with a spinner.
 */
import { useTranslation } from "react-i18next";

export function InkLoader() {
  // No suspense: this IS a loading fallback, it must never suspend itself.
  const { t } = useTranslation("shell", { useSuspense: false });
  return (
    <div
      className="theme-ink min-h-[100dvh] bg-background px-5 pt-[72px]"
      role="status"
      aria-label={t("common.loading", { defaultValue: "Loading" })}
    >
      <div className="mx-auto flex max-w-[420px] flex-col gap-4">
        <div className="h-[36vh] max-h-[300px] rounded-lg neo-border bg-card animate-pulse" />
        <div className="h-[36vh] max-h-[300px] rounded-lg neo-border bg-card animate-pulse" />
      </div>
    </div>
  );
}
