/**
 * Upgrade an anonymous + username session to a full (password) account.
 *
 * The server (users.upgradeUsernameOnly) links the new email/password credential
 * to the SAME user doc, so the username and casual progress carry over and only
 * ranked starts fresh. This component is presentational + calls
 * `upgradeAccount` from AuthContext; the human tests the real password submit.
 */
import { useCallback, useState, type FormEvent } from "react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { useAuth, AuthError } from "@/contexts/AuthContext";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "../../../../convex/lib/passwordPolicy";

interface UpgradeAccountFormProps {
  /** Called once the account is upgraded (now a full account). */
  onSuccess: () => void;
}

export function UpgradeAccountForm({ onSuccess }: UpgradeAccountFormProps) {
  const { upgradeAccount, username } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldError, setFieldError] = useState<{ field: "email" | "password" | "confirm"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setFieldError(null);
      if (!email.trim()) {
        setFieldError({ field: "email", message: "Please enter your email." });
        return;
      }
      if (password !== confirm) {
        setFieldError({ field: "confirm", message: "Passwords do not match." });
        return;
      }
      setSubmitting(true);
      try {
        await upgradeAccount(email, password, displayName.trim() || undefined);
        onSuccess();
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not upgrade your account. Try again.";
        setFieldError({ field: "password", message });
        setSubmitting(false);
      }
    },
    [email, password, confirm, displayName, upgradeAccount, onSuccess],
  );

  return (
    <div className="w-full max-w-sm mx-auto">
      <NeoCard shadow="lg" className="p-6">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Save your progress
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add an email and password to keep{" "}
            <span className="font-heading font-bold text-foreground">
              @{username ?? "your username"}
            </span>{" "}
            and unlock ranked play, leaderboards, and daily streaks.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <NeoInput
              type="email"
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={submitting}
            />
            {fieldError?.field === "email" && (
              <p role="alert" className="mt-1 text-xs text-destructive font-heading">
                {fieldError.message}
              </p>
            )}
          </div>
          <NeoInput
            type="text"
            autoComplete="nickname"
            placeholder="Display name (optional)"
            aria-label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={submitting}
          />
          <div>
            <NeoInput
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={submitting}
            />
            {fieldError?.field === "password" && (
              <p role="alert" className="mt-1 text-xs text-destructive font-heading">
                {fieldError.message}
              </p>
            )}
          </div>
          <div>
            <NeoInput
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              aria-label="Confirm password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              disabled={submitting}
            />
            {fieldError?.field === "confirm" && (
              <p role="alert" className="mt-1 text-xs text-destructive font-heading">
                {fieldError.message}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-heading text-center">
            At least {PASSWORD_MIN_LENGTH} characters. Up to {PASSWORD_MAX_LENGTH}.
          </p>


          <NeoButton
            type="submit"
            variant="primary"
            size="full"
            disabled={submitting}
            className="disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Create full account"}
          </NeoButton>
        </form>

        <p className="text-[11px] text-muted-foreground text-center mt-4 leading-snug">
          Your username and casual progress carry over. Ranked ELO starts once
          you upgrade.
        </p>
      </NeoCard>
    </div>
  );
}
