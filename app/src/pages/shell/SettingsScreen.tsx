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
import { ArrowUp, LogIn, LogOut, User } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
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
