/**
 * THE DRAW — share-link landing, /s/r/:slug (Ticket I; the DuelLinkScreen
 * pattern). A bare route: no auth wall, no layout chrome — a logged-out
 * recipient in a fresh profile must see the shared result and one CTA.
 *
 * Fetches drawShare.getSharedRun (a mutation — the open logs draw_share_view
 * server-side) and renders the shared run through the SAME ShareCard the
 * result screen uses, on the same spoiler-free payload rules. The CTA fires
 * draw_share_convert and routes to /draw, where the guest bootstrap
 * self-heals a session and the server gate throw surfaces the existing
 * "not open yet" stage while the mode is dark.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { RunOutcome } from "@/lib/drawEngine";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShareCard } from "@/components/draw/ShareCard";
import type { ShareCardData } from "@/components/draw/share";
import { buildRunShareUrl } from "@/lib/drawShareLinks";
import "@/components/draw/draw.css";

/** The getSharedRun found-payload, as the landing renders it. */
export interface SharedRunPayload {
  boardNumber: number;
  dateKey: string;
  outcome: RunOutcome;
  trail: string;
  identity: string | null;
  score: number;
  isToday: boolean;
}

interface DrawShareLandingViewProps {
  payload: SharedRunPayload;
  slug: string;
  /** draw_share_convert hook — fired on the CTA tap, before routing. */
  onConvert: () => void;
}

/** Pure render half, exported for the contract test (CTA label + routing). */
export function DrawShareLandingView({ payload, slug, onConvert }: DrawShareLandingViewProps) {
  const navigate = useNavigate();
  const data: ShareCardData = {
    boardNumber: payload.boardNumber,
    outcome: payload.outcome,
    trail: payload.trail,
    identity: payload.identity,
    score: payload.score,
    url: buildRunShareUrl(slug),
    // The landing quotes no rarity claim — that stat belongs to the sharer's
    // result screen, and serving it here would widen the public payload.
    rarity: null,
  };
  const cta = payload.isToday
    ? `PLAY TODAY'S BOARD — BEAT ${Math.round(payload.score).toLocaleString("en-US")}`
    : "PLAY TODAY'S BOARD";
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-4" data-testid="draw-share-landing">
        <p className="text-center font-heading font-bold text-[11px] tracking-widest text-muted-foreground">
          A FRIEND TOOK ON BOARD #{payload.boardNumber}
        </p>
        <ShareCard data={data} />
        <NeoButton
          variant="primary"
          size="xl"
          className="w-full"
          data-testid="draw-share-landing-cta"
          onClick={() => {
            onConvert();
            navigate("/draw");
          }}
        >
          {cta}
        </NeoButton>
      </div>
    </div>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-4" data-testid="draw-share-landing-missing">
        <NeoCard color="destructive" shadow="lg" className="text-center py-6 px-4">
          <p className="font-heading font-bold text-sm">THIS LINK LEADS NOWHERE</p>
          <p className="text-xs text-muted-foreground mt-2 leading-snug">
            The shared run doesn't exist (or its link was mistyped).
          </p>
        </NeoCard>
        <NeoButton variant="primary" size="xl" className="w-full" onClick={() => navigate("/draw")}>
          PLAY TODAY'S BOARD
        </NeoButton>
      </div>
    </div>
  );
}

export default function DrawShareLanding() {
  const { slug = "" } = useParams<{ slug: string }>();
  const getSharedRun = useMutation(api.drawShare.getSharedRun);
  const recordShareConvert = useMutation(api.drawShare.recordShareConvert);
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "missing" }
    | { phase: "ready"; payload: SharedRunPayload }
  >({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    getSharedRun({ slug })
      .then((result) => {
        if (cancelled) return;
        setState(
          result.found
            ? { phase: "ready", payload: result as SharedRunPayload & { found: true } }
            : { phase: "missing" },
        );
      })
      // A fetch failure renders as missing rather than a dead spinner — the
      // landing has no retry surface and the CTA path stays available.
      .catch(() => {
        if (!cancelled) setState({ phase: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [getSharedRun, slug]);

  if (state.phase === "loading") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading…</p>
      </div>
    );
  }
  if (state.phase === "missing") return <NotFound />;
  return (
    <DrawShareLandingView
      payload={state.payload}
      slug={slug}
      // Fire-and-forget: an analytics write must never block or break routing.
      onConvert={() => void recordShareConvert({ slug }).catch(() => {})}
    />
  );
}
