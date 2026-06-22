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
import { ArrowUp, CalendarDays, LogIn, LogOut, User } from "lucide-react";
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
