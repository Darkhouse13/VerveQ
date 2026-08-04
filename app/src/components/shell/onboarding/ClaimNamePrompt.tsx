/**
 * Post-result name claim — the reward hook that replaces the pre-play toll.
 *
 * A visitor who reached a result screen on a silently-minted anonymous session
 * has already spent real effort and has a real, already-persisted score. This
 * is the first and only moment we ask for a name, and the ask is framed by
 * what the name unlocks rather than by what we want.
 *
 * Hard rules (FR-1B Part 4):
 *  - It NEVER blocks the score. This renders INLINE, below the result, and is
 *    deliberately not a modal or an overlay — the player can read their score,
 *    share it, and leave without ever touching this card.
 *  - One per result screen, and dismissible for the session.
 *  - It only claims. The claim is an in-place patch of the SAME users doc
 *    (`users.claimUsernameOnly`), so the score recorded seconds ago is the
 *    score that appears — there is no copy, migration, or backfill.
 *
 * Truthfulness: `board` names the public board the claim actually puts this
 * result on, and drives the copy. Passing it for a mode with no public board
 * would promise a listing that does not exist, so it is optional.
 *
 * The no-board copy must name NO board, and that is stricter than it sounds.
 * Its first version said results would "carry your name — on leaderboards, in
 * duels and arenas", which reads as generic but is the same false promise in
 * looser words: the Daily has no board of its own, so blind verification
 * O-FR1B refuted it. Per the owner ruling the no-board strings now speak only
 * to what a claim actually changes for a Daily player — the run becoming
 * attached to a name — and mention no board, leaderboard, duel or arena.
 */
import { useCallback, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";
import { useAuth, AuthError } from "@/contexts/AuthContext";
import { ANONYMOUS_FIRST_ENABLED } from "@/lib/flags";
import { track } from "@/lib/analytics";
import { getEntrySource } from "@/lib/entrySource";

// Mirrors convex/lib/usernames.ts for instant pre-submit feedback; the server
// stays the source of truth.
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

interface ClaimNamePromptProps {
  /**
   * The public board this result lands on once a name exists. Omit for modes
   * that have no public board — the copy then makes no board promise.
   */
  board?: "blitz";
  /** Mode slug, for the claim-conversion funnel. */
  source: string;
}

export function ClaimNamePrompt({ board, source }: ClaimNamePromptProps) {
  const { t } = useTranslation("screens");
  const { accountState, hasUsername, claimUsername } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [claimed, setClaimed] = useState<string | null>(null);

  const normalized = username.trim().toLowerCase();
  const valid = USERNAME_RE.test(normalized);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      if (!valid) {
        setError(
          t("claimName.invalid", {
            defaultValue:
              "Username must be 3-24 lowercase letters, numbers, or underscores.",
          }),
        );
        return;
      }
      setSubmitting(true);
      try {
        await claimUsername(normalized);
        track("username_claimed", {
          entry_source: getEntrySource(),
          via_invite: false,
          via_result_prompt: true,
          mode: source,
        });
        setClaimed(normalized);
      } catch (err) {
        setError(
          err instanceof AuthError
            ? t(`authError.${err.code}`, { defaultValue: err.message })
            : t("claimName.genericError", {
                defaultValue: "Could not claim that name. Try another one.",
              }),
        );
        setSubmitting(false);
      }
    },
    [valid, normalized, claimUsername, source, t],
  );

  if (!ANONYMOUS_FIRST_ENABLED) return null;
  if (dismissed) return null;

  // Success state: keep the card in place rather than unmounting it, so the
  // claim visibly resolves instead of the UI just swallowing the form.
  if (claimed) {
    return (
      <NeoCard color="success" className="w-full text-center py-4 mb-4">
        <p className="font-heading font-bold text-base">
          {board
            ? t("claimName.doneOnBoard", {
                defaultValue: "You're on the board as @{{handle}}.",
                handle: claimed,
              })
            : t("claimName.done", {
                defaultValue: "Your name is @{{handle}}.",
                handle: claimed,
              })}
        </p>
      </NeoCard>
    );
  }

  // Only a live session WITHOUT a name has anything to claim. `hasUsername`
  // covers both named tiers; `loggedOut` has no doc to patch and `loading`
  // must not flash the ask at a returning user mid-settle.
  if (accountState !== "needsUsername" || hasUsername) return null;

  return (
    <NeoCard shadow="lg" className="w-full py-4 px-4 mb-4">
      <p className="font-heading font-bold text-lg text-center">
        {board
          ? t("claimName.titleBoard", {
              defaultValue: "You're not on the board yet",
            })
          : t("claimName.title", {
              defaultValue: "This run isn't saved to a name",
            })}
      </p>
      <p className="text-sm text-muted-foreground text-center mt-1 mb-3">
        {board
          ? t("claimName.bodyBoard", {
              defaultValue: "Claim a name and this score goes on the board.",
            })
          : t("claimName.body", {
              defaultValue:
                "Claim a name and your streak and history stick with you.",
            })}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
        <NeoInput
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={t("claimName.placeholder", { defaultValue: "username" })}
          aria-label={t("claimName.label", { defaultValue: "Username" })}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase());
            if (error) setError(null);
          }}
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground font-heading text-center">
          {t("claimName.rule", {
            defaultValue:
              "3–24 characters: lowercase letters, numbers, underscores.",
          })}
        </p>

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
          {submitting ? (
            <Loader2 className="animate-spin mx-auto" size={18} strokeWidth={2.5} />
          ) : (
            t("claimName.cta", { defaultValue: "CLAIM MY NAME" })
          )}
        </NeoButton>
      </form>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        disabled={submitting}
        className="w-full text-sm text-muted-foreground font-heading underline underline-offset-4 hover:text-foreground mt-3"
      >
        {t("claimName.dismiss", { defaultValue: "keep playing" })}
      </button>
    </NeoCard>
  );
}
