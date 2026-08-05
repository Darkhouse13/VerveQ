/**
 * THE WEEKEND × Home — pre-launch teaser + waitlist (Ticket FW-P1).
 *
 * A full-width hero card at the top of the v2 Home (directly under the Draw
 * hero slot) announcing the upcoming fantasy mode and taking one action:
 * join the waitlist. Two identity paths:
 *
 *   - Signed-in (any server identity with a username): one tap, no input.
 *     Membership is server-persisted (fantasyWaitlist.by_userId), so the
 *     confirmed state survives revisits.
 *   - Anonymous: email field + join. Confirmed state is session-visual only
 *     (deliberate — no client-side identity is minted for an email join).
 *
 * Gating is RUNTIME-ONLY and fails closed and silent, HomeDrawCard-style:
 * the card renders nothing until fantasyWaitlist.getTeaserStatus answers.
 * Until the waitlist backend is deployed (or on any gate/network failure)
 * the call rejects, the catch swallows it, and Home is exactly as before —
 * no error state on Home, ever. That also makes the prod Convex deploy the
 * teaser's launch switch: no build flag, nothing to flip.
 *
 * Copy is English-only (the Draw-surface precedent) and every product claim
 * is drawn from the LOCKED specs: five leagues (SCORING_SPEC §inputs), crowd
 * ratings (CROWD_VOTING_SPEC), weekly fresh squads / no season grind
 * (BUDGET_MODE_SPEC + DRAFT_ROOM_SPEC founding shape). The waitlist count
 * renders only at >= 50 — no sad small numbers.
 *
 * Privacy: the email string goes to the join mutation and NOWHERE else — it
 * is never echoed into analytics properties, logs, or any query result.
 *
 * Structure: data container + pure view (exported for the contract tests),
 * mirroring HomeDrawCard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarRange } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { readColdSource } from "@/lib/coldSession";
import { isWeekendTopRequested } from "@/lib/weekendDeepLink";
import { api } from "../../../convex/_generated/api";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoInput } from "@/components/neo/NeoInput";

type TeaserStatus = FunctionReturnType<
  typeof api.fantasyWaitlist.getTeaserStatus
>;

/** Client mirror of the server check (AuthContext EMAIL_RE precedent) — a
 *  fast local reject; the mutation remains the source of truth. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Count line threshold — below this the line simply doesn't exist. */
const COUNT_FLOOR = 50;

const BULLETS = [
  "All five top leagues, one squad",
  "The crowd rates the players, not an algorithm",
  "Fresh draft every week, no season-long grind",
] as const;

const LAUNCH_LINE = "Kicks off with the season — late August.";
const CONSENT_LINE = "We'll email you once, when it starts.";

export interface HomeWeekendTeaserViewProps {
  /** "user" = one-tap join path; "email" = anonymous email path. */
  identity: "user" | "email";
  /** Already on the list (server-read for users, session-visual for email). */
  member: boolean;
  /** Total waitlist size; the line renders only at >= COUNT_FLOOR. */
  count: number;
  pending: boolean;
  /** Human-readable failure line for the email form; null = no error. */
  error: string | null;
  onJoinUser: () => void;
  onJoinEmail: (email: string) => void;
  /** Fired ONCE, when the card is genuinely on screen (see useOnceVisible).
   *  Optional so the contract tests can drive the view without a viewport. */
  onVisible?: () => void;
}

/**
 * Fire `onVisible` once the element is genuinely on screen — half of it in the
 * viewport AND the tab foregrounded, the same rule the SEO funnel's
 * `landing_cta_shown` uses (`public/games/funnel.js`).
 *
 * Both halves matter. Intersection alone is satisfied by a backgrounded or
 * prerendered tab that no human has looked at; `document.visibilityState`
 * alone says nothing about whether this particular card was scrolled to. On a
 * Home where the card can sit below a hero, mounting is not seeing.
 *
 * Without IntersectionObserver (old Safari) it reports NOTHING rather than
 * guessing — a missing step is honest, a fabricated one corrupts the funnel.
 */
function useOnceVisible(
  ref: React.RefObject<HTMLElement | null>,
  onVisible?: () => void,
) {
  const firedRef = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onVisible || firedRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;

    const fireIfVisible = () => {
      if (firedRef.current) return;
      if (document.visibilityState !== "visible") return;
      firedRef.current = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      onVisible();
    };

    // A card that is already in view while the tab is BACKGROUNDED would
    // otherwise never report: the observer fires once, is rejected on
    // visibility, and never fires again because nothing intersects anew when
    // the human returns. Re-checking on foreground closes that hole.
    let intersecting = false;
    const onVisibilityChange = () => {
      if (intersecting) fireIfVisible();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting = entry.isIntersecting;
          if (entry.isIntersecting) fireIfVisible();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ref, onVisible]);
}

/** Pure view — no data access; the contract tests drive this directly. */
export function HomeWeekendTeaserView({
  identity,
  member,
  count,
  pending,
  error,
  onJoinUser,
  onJoinEmail,
  onVisible,
}: HomeWeekendTeaserViewProps) {
  const [email, setEmail] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  useOnceVisible(rootRef, onVisible);
  return (
    // Bottom spacing lives on the card's own root (HomeDrawCard idiom) so
    // its absence leaves no trace in the Home column.
    <div
      ref={rootRef}
      className="shrink-0 pb-3 md:pb-4"
      data-testid="home-weekend-teaser"
    >
      <div className="neo-border neo-shadow-lg rounded-lg bg-foreground text-background p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Pitch column */}
        <div className="min-w-0 md:flex-1">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5">
            <CalendarRange size={12} strokeWidth={3} />
            New mode · Late August
          </p>
          <p className="font-heading font-black uppercase leading-[0.95] text-[34px] md:text-[42px] text-accent mt-1.5">
            The Weekend
          </p>
          <p className="font-heading font-bold text-base md:text-lg leading-tight mt-2">
            Draft the whole European football weekend.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {BULLETS.map((line) => (
              <li
                key={line}
                className="font-mono text-[11px] uppercase tracking-wide text-background/70 flex gap-2"
              >
                <span aria-hidden className="text-accent">
                  ■
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action column */}
        <div className="md:w-[300px] md:shrink-0 flex flex-col gap-2">
          {member ? (
            <div data-testid="weekend-confirmed">
              <p className="font-heading font-black uppercase text-2xl leading-none text-accent">
                You're in.
              </p>
              <p className="font-mono text-[11px] uppercase text-background/70 mt-1.5">
                {LAUNCH_LINE}
              </p>
            </div>
          ) : identity === "user" ? (
            <>
              <NeoButton
                variant="accent"
                size="full"
                disabled={pending}
                onClick={onJoinUser}
                data-testid="weekend-cta-user"
              >
                Count me in
              </NeoButton>
              <p className="font-mono text-[10.5px] uppercase text-background/60">
                {LAUNCH_LINE}
              </p>
            </>
          ) : (
            <form
              className="flex flex-col gap-2"
              // Our own inline error line + the server verdict do the
              // validating; the native bubble would preempt both.
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!pending) onJoinEmail(email);
              }}
            >
              <div className="flex gap-2">
                <NeoInput
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  aria-label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-w-0 flex-1 py-2.5 text-sm bg-background text-foreground"
                  data-testid="weekend-email-input"
                />
                <NeoButton
                  variant="accent"
                  size="md"
                  type="submit"
                  disabled={pending}
                  className="shrink-0"
                  data-testid="weekend-cta-email"
                >
                  Join
                </NeoButton>
              </div>
              {error && (
                <p
                  className="font-mono text-[11px] uppercase text-yellow"
                  data-testid="weekend-error"
                >
                  {error}
                </p>
              )}
              <p className="font-mono text-[10.5px] uppercase text-background/60">
                {CONSENT_LINE}
              </p>
            </form>
          )}
          {count >= COUNT_FLOOR && (
            <p
              className="font-mono text-[11px] font-bold uppercase text-accent"
              data-testid="weekend-count"
            >
              {count.toLocaleString("en-US")} drafters already in
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Data container. One imperative status read on auth settle (the runtime
 * gate), then the two join paths. Every failure path before first render
 * ends with the card hidden; failures after render surface only as the
 * email form's inline line.
 */
function HomeWeekendTeaserInner() {
  const convex = useConvex();
  const { hasUsername, accountState } = useAuth();
  const settled = accountState !== "loading";
  const [status, setStatus] = useState<TeaserStatus | null>(null);
  const [member, setMember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewed = useRef(false);

  // Attribution: utm_source ?? ref from the landing URL, else the placement
  // tag. Read once per mount — the teaser's source is where the visit came
  // from, not where the SPA has since navigated.
  const sourceRef = useRef<string | undefined>(undefined);
  if (sourceRef.current === undefined) {
    sourceRef.current = readColdSource() ?? "home_teaser";
  }
  const source = sourceRef.current;

  // Where on Home this card was rendered. `?w=1` (the /weekend short link)
  // leads with the card; anything else has it below the Draw hero. Read from
  // the same mount-time URL as `source` above, and carried on the viewport
  // event so tap-rate can be compared BY PLACEMENT rather than assumed.
  const placementRef = useRef<string | undefined>(undefined);
  if (placementRef.current === undefined) {
    placementRef.current =
      typeof window !== "undefined" &&
      isWeekendTopRequested(window.location.search)
        ? "top"
        : "default";
  }
  const placement = placementRef.current;

  // Viewport-qualified "the human actually saw it". Distinct from
  // `teaser_viewed`, which fires when the card MOUNTS — on a Home where the
  // card can sit below the fold those are very different populations, and the
  // gap between them is exactly the thing this funnel needs to measure.
  const seen = useRef(false);
  const onVisible = useCallback(() => {
    if (seen.current) return;
    seen.current = true;
    track("waitlist_card_viewed", { source, placement });
  }, [source, placement]);

  useEffect(() => {
    if (!settled) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await convex.query(api.fantasyWaitlist.getTeaserStatus, {});
        if (cancelled) return;
        setStatus(result);
        setMember(result.member);
        if (!viewed.current) {
          viewed.current = true;
          track("teaser_viewed", { source });
        }
      } catch {
        // Backend not deployed, gate throw, lost session, network — all land
        // here and the card simply never appears on Home.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convex, settled, source]);

  if (!status) return null;

  const identity = hasUsername ? "user" : "email";

  const joinAsUser = async () => {
    track("waitlist_join_clicked", { method: "user", source });
    setPending(true);
    try {
      const result = await convex.mutation(api.fantasyWaitlist.joinWaitlistAsUser, {
        source,
      });
      if (result.ok) {
        setMember(true);
        if (result.joined) track("waitlist_joined", { method: "user", source });
      }
    } catch {
      // Transient server/network failure: stay unjoined, button re-arms.
    } finally {
      setPending(false);
    }
  };

  const joinWithEmail = async (email: string) => {
    track("waitlist_join_clicked", { method: "email", source });
    if (!EMAIL_RE.test(email.trim().toLowerCase())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await convex.mutation(
        api.fantasyWaitlist.joinWaitlistWithEmail,
        { email, source },
      );
      if (result.ok) {
        setMember(true);
        if (result.joined) track("waitlist_joined", { method: "email", source });
      } else if (result.code === "invalid_email") {
        setError("Enter a valid email address.");
      } else {
        setError("Busy right now — try again in a few minutes.");
      }
    } catch {
      setError("Busy right now — try again in a few minutes.");
    } finally {
      setPending(false);
    }
  };

  return (
    <HomeWeekendTeaserView
      identity={identity}
      member={member}
      count={status.count}
      pending={pending}
      error={error}
      onJoinUser={() => void joinAsUser()}
      onJoinEmail={(email) => void joinWithEmail(email)}
      onVisible={onVisible}
    />
  );
}

export function HomeWeekendTeaser() {
  return <HomeWeekendTeaserInner />;
}
