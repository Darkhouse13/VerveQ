/**
 * Upgrade an anonymous + username session to a full (password) account.
 *
 * The server (users.upgradeUsernameOnly) links the new email/password credential
 * to the SAME user doc, so the username and casual progress carry over and only
 * ranked starts fresh. This component is presentational + calls
 * `upgradeAccount` from AuthContext; the human tests the real password submit.
 */
import { useCallback, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth, AuthError } from "@/contexts/AuthContext";
import {
  validatePassword,
  describePasswordReason,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "../../../../convex/lib/passwordPolicy";

interface UpgradeAccountFormProps {
  /** Called once the account is upgraded (now a full account). */
  onSuccess: () => void;
}

// Mirrors AuthContext's permissive shape check; the server (and the OTP email)
// do the real verification.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validation feedback is keyed to the field the user is acting on, so the
// message renders directly under that input (not in a detached banner).
type FieldErrors = {
  email?: string;
  password?: string;
  confirm?: string;
  general?: string;
};

function fieldForAuthError(err: AuthError): keyof FieldErrors {
  switch (err.code) {
    case "invalid_email":
    case "legacy_email":
    case "email_taken":
      return "email";
    case "weak_password":
      return "password";
    case "password_mismatch":
      return "confirm";
    default:
      return "general";
  }
}

export function UpgradeAccountForm({ onSuccess }: UpgradeAccountFormProps) {
  const { t } = useTranslation("screens");
  const { upgradeAccount, username } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const clearError = useCallback((field: keyof FieldErrors) => {
    setErrors((prev) =>
      prev[field] || prev.general
        ? { ...prev, [field]: undefined, general: undefined }
        : prev,
    );
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      // Validate with the SAME shared policy the server enforces
      // (convex/lib/passwordPolicy) so the user sees every rule violation
      // inline, at the field, before a network round-trip.
      const next: FieldErrors = {};
      if (!email.trim()) {
        next.email = t("upgradeForm.emailRequired", {
          defaultValue: "Please enter your email.",
        });
      } else if (!EMAIL_RE.test(email.trim().toLowerCase())) {
        next.email = t("upgradeForm.emailInvalid", {
          defaultValue: "Please enter a valid email address.",
        });
      }
      const pw = validatePassword(password);
      if (!pw.ok && pw.reason) {
        next.password = t(`passwordReason.${pw.reason}`, {
          defaultValue: describePasswordReason(pw.reason),
          min: PASSWORD_MIN_LENGTH,
          max: PASSWORD_MAX_LENGTH,
        });
      }
      if (!next.password && password !== confirm) {
        next.confirm = t("upgradeForm.passwordMismatch", {
          defaultValue: "Passwords do not match.",
        });
      }
      setErrors(next);
      if (next.email || next.password || next.confirm) return;
      setSubmitting(true);
      try {
        await upgradeAccount(email, password, displayName.trim() || undefined);
        onSuccess();
      } catch (err) {
        if (err instanceof AuthError) {
          setErrors({
            [fieldForAuthError(err)]: t(`authError.${err.code}`, {
              defaultValue: err.message,
            }),
          });
        } else {
          setErrors({
            general:
              err instanceof Error
                ? err.message
                : t("upgradeForm.genericError", {
                    defaultValue: "Could not upgrade your account. Try again.",
                  }),
          });
        }
        setSubmitting(false);
      }
    },
    [email, password, confirm, displayName, upgradeAccount, onSuccess, t],
  );

  const fieldError = (text: string | undefined, id: string) =>
    text ? (
      <p id={id} role="alert" className="mt-1 text-meta font-bold text-destructive">
        {text}
      </p>
    ) : null;

  return (
    <div className="w-full max-w-sm mx-auto">
      <Card elevation="lifted" padding="lg">
        <div className="text-center mb-5">
          <h1 className="font-heading text-title font-bold">
            {t("upgradeForm.title", { defaultValue: "Save your progress" })}
          </h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {t("upgradeForm.subtitleBefore", {
              defaultValue: "Add an email and password to keep",
            })}{" "}
            <span className="font-heading font-bold text-foreground">
              @
              {username ??
                t("upgradeForm.usernameFallback", { defaultValue: "your username" })}
            </span>{" "}
            {t("upgradeForm.subtitleAfter", {
              defaultValue: "and unlock ranked play and global leaderboards.",
            })}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("upgradeForm.emailPlaceholder", { defaultValue: "Email" })}
              aria-label={t("upgradeForm.emailLabel", { defaultValue: "Email" })}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "upgrade-email-error" : undefined}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
              }}
              disabled={submitting}
            />
            {fieldError(errors.email, "upgrade-email-error")}
          </div>
          <Input
            type="text"
            autoComplete="nickname"
            placeholder={t("upgradeForm.displayNamePlaceholder", {
              defaultValue: "Display name (optional)",
            })}
            aria-label={t("upgradeForm.displayNameLabel", {
              defaultValue: "Display name",
            })}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={submitting}
          />
          <div>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t("upgradeForm.passwordPlaceholder", {
                defaultValue: "Password",
              })}
              aria-label={t("upgradeForm.passwordLabel", { defaultValue: "Password" })}
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password ? "upgrade-password-error" : "upgrade-password-hint"
              }
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
              disabled={submitting}
            />
            <p
              id="upgrade-password-hint"
              className="mt-1 text-meta text-muted-foreground"
            >
              {t("upgradeForm.passwordHint", {
                defaultValue:
                  "{{min}}–{{max}} characters; common passwords are rejected.",
                min: PASSWORD_MIN_LENGTH,
                max: PASSWORD_MAX_LENGTH,
              })}
            </p>
            {fieldError(errors.password, "upgrade-password-error")}
          </div>
          <div>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t("upgradeForm.confirmPlaceholder", {
                defaultValue: "Confirm password",
              })}
              aria-label={t("upgradeForm.confirmLabel", {
                defaultValue: "Confirm password",
              })}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? "upgrade-confirm-error" : undefined}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearError("confirm");
              }}
              disabled={submitting}
            />
            {fieldError(errors.confirm, "upgrade-confirm-error")}
          </div>

          {errors.general && (
            <div
              role="alert"
              className="text-center text-body-sm font-bold text-destructive"
            >
              {errors.general}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={submitting}
            aria-label={submitting ? t("upgradeForm.saving", { defaultValue: "Saving…" }) : undefined}
          >
            {t("upgradeForm.submit", { defaultValue: "Create full account" })}
          </Button>
        </form>

        <p className="mt-4 text-center text-meta text-muted-foreground">
          {t("upgradeForm.footer", {
            defaultValue:
              "Your username and casual progress carry over. Ranked ELO starts once you upgrade.",
          })}
        </p>
      </Card>
    </div>
  );
}
