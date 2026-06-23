/**
 * v2 Settings — preferences + account hub. Reached from the Profile header gear.
 *
 * Sections:
 *  - Language: the shared LanguageSwitcher (also reachable nowhere else now —
 *    it moved here out of Profile).
 *  - Account: identity summary, the upgrade CTA for username-only "guest"
 *    accounts, and Sign Out (with a confirm dialog) — all relocated from Profile
 *    so account management lives in one place.
 *
 * The route guard (UsernameOnlyRoute) guarantees a server identity here, same as
 * Profile, so the account section always has a handle to show.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { ArrowUp, CalendarDays, LifeBuoy, LogIn, LogOut, Mail, User } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { api } from "../../../convex/_generated/api";
import {
  DAILY_SUBJECTS,
  usePreferredDailySport,
} from "@/hooks/usePreferredDailySport";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useAuth } from "@/contexts/AuthContext";

// Public contact surfaces — a generic mailbox (keeps personal identity out of
// the app) and the project's X account.
const SUPPORT_EMAIL = "support@verveq.com";
const X_URL = "https://x.com/playverveq";
const X_HANDLE = "@playverveq";

// X brand mark (lucide dropped brand icons).
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.65l-5.213-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, username, isUsernameOnly, accountState, logout } = useAuth();
  const [signOutOpen, setSignOutOpen] = useState(false);

  // Daily Challenge subject preference. The picker reflects the same resolved
  // value the banner/home/play screens use; saving patches the user doc, which
  // those readers pick up reactively via api.users.me.
  const currentDailySport = usePreferredDailySport();
  const setPreferredDailySport = useMutation(api.users.setPreferredDailySport);
  const [savingDailySport, setSavingDailySport] = useState<string | null>(null);
  const selectedDailySport = savingDailySport ?? currentDailySport;

  const handlePickDailySport = async (sport: string) => {
    if (sport === currentDailySport || savingDailySport) return;
    setSavingDailySport(sport);
    try {
      await setPreferredDailySport({ sport });
      toast.success(t("settings.dailySaved"));
    } catch (error) {
      toast.error(friendlyError(error, t("settings.dailyHeading")));
    } finally {
      setSavingDailySport(null);
    }
  };

  // Language is a device preference (works for everyone). The account section
  // only renders controls when there's an identity; logged-out visitors get a
  // sign-in CTA instead, so Settings is coherent in every auth state.
  const signedIn = accountState === "usernameOnly" || accountState === "fullAccount";
  const guest = isUsernameOnly;
  const handle = username ?? user?.username ?? "";

  return (
    <ShellLayout
      title={t("settings.title")}
      subtitle={t("settings.eyebrow")}
      back
      onBack={() => navigate(SHELL_ROUTES.profile)}
    >
      <div className="mx-auto w-full max-w-md flex flex-col gap-4 pt-1">
        {/* Language */}
        <NeoCard>
          <LanguageSwitcher />
        </NeoCard>

        {/* Daily Challenge subject — only meaningful with an identity to store
            it on; logged-out visitors don't see it. */}
        {signedIn && (
          <NeoCard className="flex flex-col gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <CalendarDays size={13} strokeWidth={2.5} />
              {t("settings.dailyHeading")}
            </span>
            <p className="text-xs text-muted-foreground">
              {t("settings.dailyDescription")}
            </p>
            <div
              className="grid grid-cols-2 gap-2"
              role="group"
              aria-label={t("settings.dailyHeading")}
            >
              {DAILY_SUBJECTS.map((subject) => {
                const selected = selectedDailySport === subject;
                return (
                  <button
                    key={subject}
                    type="button"
                    aria-pressed={selected}
                    disabled={savingDailySport !== null}
                    onClick={() => void handlePickDailySport(subject)}
                    className={cn(
                      "neo-border rounded-lg px-2 py-2 font-heading font-bold text-[13px] transition-all disabled:opacity-60",
                      selected
                        ? "bg-foreground text-background neo-shadow"
                        : "bg-card active:neo-shadow-pressed",
                    )}
                  >
                    {t(`settings.dailySubjects.${subject}`)}
                  </button>
                );
              })}
            </div>
          </NeoCard>
        )}

        {/* Account — controls when signed in, a sign-in CTA when not. */}
        <NeoCard className="flex flex-col gap-3.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <User size={13} strokeWidth={2.5} />
            {t("settings.accountHeading")}
          </span>

          {signedIn ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-base truncate">
                    {handle ? `@${handle}` : t("settings.accountNoHandle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {guest ? t("settings.accountGuest") : t("settings.accountFull")}
                  </p>
                </div>
              </div>

              {guest && (
                <NeoButton
                  variant="primary"
                  size="full"
                  data-testid="settings-upgrade-cta"
                  onClick={() =>
                    navigate(
                      `${SHELL_ROUTES.upgrade}?next=${encodeURIComponent(SHELL_ROUTES.settings)}`,
                    )
                  }
                >
                  <ArrowUp size={16} strokeWidth={3} className="mr-1" />
                  {t("profile.upgradeCta")}
                </NeoButton>
              )}

              {guest && (
                <p className="font-mono text-[10px] uppercase tracking-wide text-destructive">
                  {t("profile.signOutWarning")}
                </p>
              )}
              <NeoButton
                variant="secondary"
                size="full"
                className="text-destructive"
                onClick={() => setSignOutOpen(true)}
              >
                <LogOut size={16} strokeWidth={2.5} className="mr-1" />
                {t("profile.signOut")}
              </NeoButton>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("settings.notSignedIn")}</p>
              <NeoButton
                variant="primary"
                size="full"
                data-testid="settings-signin-cta"
                onClick={() =>
                  navigate(
                    `${SHELL_ROUTES.account}?next=${encodeURIComponent(SHELL_ROUTES.settings)}`,
                  )
                }
              >
                <LogIn size={16} strokeWidth={2.5} className="mr-1" />
                {t("settings.signInCta")}
              </NeoButton>
            </>
          )}
        </NeoCard>

        {/* Support & Community — universal; shown signed in or out. */}
        <NeoCard className="flex flex-col gap-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <LifeBuoy size={13} strokeWidth={2.5} />
            {t("settings.supportHeading")}
          </span>
          <p className="text-xs text-muted-foreground">
            {t("settings.supportDescription")}
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="neo-border rounded-lg bg-card px-3 py-2.5 flex items-center gap-2 font-heading font-bold text-[13px] transition-all active:neo-shadow-pressed"
            >
              <XLogo className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{t("settings.supportFollowX")}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {X_HANDLE}
              </span>
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="neo-border rounded-lg bg-card px-3 py-2.5 flex items-center gap-2 font-heading font-bold text-[13px] transition-all active:neo-shadow-pressed"
            >
              <Mail size={16} strokeWidth={2.5} className="shrink-0" />
              <span className="flex-1 text-left">{t("settings.supportContact")}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {SUPPORT_EMAIL}
              </span>
            </a>
          </div>
        </NeoCard>
      </div>

      {signedIn && (
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="neo-border bg-card">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">
              {t("profile.signOutConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {guest
                ? t("profile.signOutConfirmBodyGuest")
                : t("profile.signOutConfirmBody")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <NeoButton
              variant="secondary"
              size="full"
              onClick={() => setSignOutOpen(false)}
            >
              {t("profile.cancel")}
            </NeoButton>
            <NeoButton
              variant="danger"
              size="full"
              onClick={async () => {
                setSignOutOpen(false);
                await logout();
                navigate("/", { replace: true });
              }}
            >
              {guest
                ? t("profile.signOutConfirmCtaGuest")
                : t("profile.signOutConfirmCta")}
            </NeoButton>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </ShellLayout>
  );
}
