/**
 * Username-only onboarding (no password) for the low-friction v2 flow.
 *
 * One field, one button: pick a username and you're in. On submit we mint a
 * real Convex ANONYMOUS session (if the visitor has none yet) and then claim
 * the username server-side via `users.claimUsernameOnly`. Collisions are
 * rejected and the visitor simply retries — there is no auto-suffixing.
 *
 * This is a presentational/flow component reused in two places:
 *  - the `/v2/welcome` route (generic "get started"), and
 *  - inline inside the Arena invite flow (so the lobby code is never dropped).
 *
 * The caller decides what "done" means via `onComplete` — it fires once the
 * user is an anonymous session WITH a username (server-authoritative).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Loader2 } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { NeoLogo } from "@/components/neo/NeoLogo";
import { useAuth, AuthError } from "@/contexts/AuthContext";

// Mirror the server's username rule (convex/lib/usernames.ts) for instant,
// pre-submit feedback. The server remains the source of truth.
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

interface UsernameOnlyOnboardingProps {
  /** Lobby/invite code, forwarded to the claim for server scoping + rate limiting. */
  inviteCode?: string;
  /** Headline copy (defaults suit a generic "get started" context). */
  heading?: string;
  /** Sub copy under the headline. */
  subheading?: string;
  /** Submit button label (e.g. "Join the arena"). */
  submitLabel?: string;
  /** Fires once the visitor is an anonymous session WITH a username. */
  onComplete: () => void;
}

export function UsernameOnlyOnboarding({
  inviteCode,
  heading = "Pick a username",
  subheading = "That's all it takes to start playing. No email, no password.",
  submitLabel = "Start playing",
  onComplete,
}: UsernameOnlyOnboardingProps) {
  const {
    accountState,
    hasUsername,
    startAnonymousSession,
    claimUsername,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const completedRef = useRef(false);

  const normalized = username.trim().toLowerCase();
  const valid = USERNAME_RE.test(normalized);

  // Already has a username (e.g. a returning anonymous+username user landed
  // here): hand control straight back to the caller.
  useEffect(() => {
    if (hasUsername && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [hasUsername, onComplete]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      if (!valid) {
        setError(
          "Username must be 3-24 lowercase letters, numbers, or underscores.",
        );
        return;
      }
      setSubmitting(true);
      try {
        // Per the design flow: sign in anonymously, THEN claim the username.
        // claimUsername() rides out the brief auth-propagation window itself.
        if (accountState === "loggedOut") {
          await startAnonymousSession();
        }
        await claimUsername(normalized, { inviteCode });
        completedRef.current = true;
        onComplete();
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not claim that username. Try another one.";
        setError(message);
        setSubmitting(false);
      }
    },
    [
      valid,
      accountState,
      normalized,
      inviteCode,
      startAnonymousSession,
      claimUsername,
      onComplete,
    ],
  );

  if (accountState === "loading" || (hasUsername && completedRef.current)) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={28} strokeWidth={2.5} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <NeoCard shadow="lg" className="p-6">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <NeoLogo size="md" />
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">
              {heading}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{subheading}</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <NeoInput
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              autoFocus
              placeholder="username"
              aria-label="Username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase());
                if (error) setError(null);
              }}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground font-heading text-center mt-1.5">
              Your handle: @{normalized || "username"}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="text-sm text-destructive font-heading text-center"
            >
              {error}
            </div>
          )}

          <NeoButton
            type="submit"
            variant="primary"
            size="full"
            disabled={submitting || !valid}
            className="disabled:opacity-60"
          >
            {submitting ? "Setting up…" : submitLabel}
          </NeoButton>
        </form>

        <p className="text-[11px] text-muted-foreground text-center mt-4 leading-snug">
          Username-only play is casual and unranked. You can add an email and
          password later to save your progress and go ranked.
        </p>
      </NeoCard>
    </div>
  );
}
