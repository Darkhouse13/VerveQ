/**
 * THE WEEKEND — the reclamation court (FW-LAUNCH O3,
 * RECLAMATION_COURT_SPEC v1.0.1).
 *
 * The docket, in one screen: file a position claim (2 per gameweek),
 * endorse open filings toward the threshold, vote on trials (the server
 * refuses conflicted jurors and the filer), and read the decided log with
 * its public tallies — "the people ruled Trent a midfielder, 71–29".
 *
 * Same gating as its siblings: imperative first query, fail closed and
 * silent, route registered but UNLINKED. Views exported for the contract
 * suite; the default export is the data container.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { Gavel, Scale } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SLOT_ROLES, type SlotRole } from "../../../../convex/lib/fantasyConstants";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";

export type CourtDocket = NonNullable<
  FunctionReturnType<typeof api.fantasyCourt.getCourtDocket>
>;
export type CourtClaim = CourtDocket["claims"][number];
export type Market = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getMarket>>;

const STATUS_BADGES: Record<
  CourtClaim["status"],
  { label: string; color: "yellow" | "destructive" | "success" | "muted" | "blue" }
> = {
  filing: { label: "gathering", color: "yellow" },
  trial: { label: "on trial", color: "blue" },
  passed: { label: "passed", color: "success" },
  failed: { label: "failed", color: "destructive" },
  died: { label: "died", color: "muted" },
  // FW-CR1: unresolved at finality. Deliberately not a verdict colour — no
  // ruling was applied and no score moved.
  expired: { label: "expired", color: "muted" },
};

export function ClaimCard({
  claim,
  docket,
  busy,
  onEndorse,
  onVote,
}: {
  claim: CourtClaim;
  docket: CourtDocket;
  busy: boolean;
  onEndorse: () => void;
  onVote: (vote: "yes" | "no") => void;
}) {
  const { t } = useTranslation();
  const badge = STATUS_BADGES[claim.status];
  return (
    <NeoCard className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading font-bold text-sm">
            {claim.playerName}
            <span className="font-mono text-[11px] text-muted-foreground ml-2">
              {claim.positionAtFiling ?? "?"} → {claim.claimedPosition}
            </span>
          </p>
          <p className="text-[12px] mt-1">“{claim.argument}”</p>
          {claim.rebuttal !== null && (
            <p className="text-[12px] mt-1 text-muted-foreground">
              {t("weekend.rebuttalPrefix", { defaultValue: "Rebuttal:" })} “{claim.rebuttal}”
            </p>
          )}
        </div>
        <NeoBadge color={badge.color} size="sm" className="shrink-0">
          {t(`weekend.claim_${claim.status}`, { defaultValue: badge.label })}
        </NeoBadge>
      </div>

      {claim.status === "filing" && (
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] font-mono text-muted-foreground">
            {t("weekend.endorseCount", {
              defaultValue: "{{n}} / {{needed}} endorsements",
              n: claim.endorsements,
              needed: docket.endorsementThreshold,
            })}
          </p>
          {!claim.myEndorsement && !claim.filedByMe && (
            <NeoButton variant="secondary" size="sm" disabled={busy} onClick={onEndorse}>
              {t("weekend.endorse", { defaultValue: "Deserves a hearing" })}
            </NeoButton>
          )}
        </div>
      )}

      {claim.status === "trial" && (
        <div className="flex items-center justify-between mt-2 gap-2">
          <p className="text-[11px] font-mono text-muted-foreground">
            {t("weekend.quorumNote", {
              defaultValue: "quorum {{quorum}} · 60% to pass",
              quorum: docket.quorum,
            })}
          </p>
          {claim.myVote === null && !claim.filedByMe ? (
            <div className="flex gap-1.5">
              <NeoButton variant="success" size="sm" disabled={busy} onClick={() => onVote("yes")}>
                {t("weekend.voteYes", { defaultValue: "He did" })}
              </NeoButton>
              <NeoButton variant="danger" size="sm" disabled={busy} onClick={() => onVote("no")}>
                {t("weekend.voteNo", { defaultValue: "Feed's right" })}
              </NeoButton>
            </div>
          ) : claim.myVote !== null ? (
            <NeoBadge color="muted" size="sm">
              {t("weekend.votedBadge", { defaultValue: "voted {{v}}", v: claim.myVote })}
            </NeoBadge>
          ) : null}
        </div>
      )}

      {claim.tallies !== null && (claim.status === "passed" || claim.status === "failed") && (
        <p className="text-[11px] font-mono text-muted-foreground mt-2">
          {t("weekend.verdictTallies", {
            defaultValue: "{{yes}}–{{no}} weighted ({{rawYes}}–{{rawNo}} raw, {{n}} jurors)",
            yes: claim.tallies.weightedYes.toFixed(1),
            no: claim.tallies.weightedNo.toFixed(1),
            rawYes: claim.tallies.rawYes,
            rawNo: claim.tallies.rawNo,
            n: claim.tallies.rawVotes,
          })}
        </p>
      )}

      {claim.status === "expired" && (
        <p className="text-[11px] font-mono text-muted-foreground mt-2">
          {t("weekend.claimExpiredNote", {
            defaultValue: "unresolved at finality — no ruling applied, no score moved",
          })}
        </p>
      )}
    </NeoCard>
  );
}

export function FileClaimDialog({
  open,
  market,
  busy,
  onFile,
  onClose,
}: {
  open: boolean;
  market: Market | null | undefined;
  busy: boolean;
  onFile: (playerId: string, claimedPosition: SlotRole, argument: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [position, setPosition] = useState<SlotRole | null>(null);
  const [argument, setArgument] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
      setPlayerId(null);
      setPosition(null);
      setArgument("");
    }
  }, [open]);

  const results = useMemo(() => {
    if (market == null) return [];
    const needle = search.trim().toLowerCase();
    if (needle.length < 2) return [];
    return market.players
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.clubName ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [market, search]);

  const selected = market?.players.find((p) => p.playerId === playerId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto max-h-[85dvh] flex flex-col">
        <DialogTitle className="font-heading font-bold text-lg">
          {t("weekend.fileClaim", { defaultValue: "File a claim" })}
        </DialogTitle>

        {selected === null ? (
          <>
            <NeoInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("weekend.searchPlayer", { defaultValue: "Which player?" })}
            />
            <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0">
              {results.map((p) => (
                <NeoCard
                  key={p.playerId}
                  className="flex items-center justify-between py-2"
                  onClick={() => setPlayerId(p.playerId)}
                >
                  <span className="font-heading font-bold text-sm truncate">{p.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                    {p.position} · {p.clubName ?? p.clubId}
                  </span>
                </NeoCard>
              ))}
            </div>
          </>
        ) : (
          <>
            <NeoCard className="py-2 flex items-center justify-between">
              <span className="font-heading font-bold text-sm">{selected.name}</span>
              <NeoButton variant="ghost" size="sm" onClick={() => setPlayerId(null)}>
                {t("weekend.change", { defaultValue: "Change" })}
              </NeoButton>
            </NeoCard>
            <p className="text-[11px] font-mono uppercase text-muted-foreground">
              {t("weekend.heActuallyPlayed", { defaultValue: "He actually played…" })}
            </p>
            <div className="flex gap-1.5">
              {SLOT_ROLES.map((role) => (
                <NeoButton
                  key={role}
                  variant={position === role ? "primary" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPosition(role)}
                >
                  {role}
                </NeoButton>
              ))}
            </div>
            <NeoInput
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              maxLength={280}
              placeholder={t("weekend.argumentPlaceholder", {
                defaultValue: "Your one-line case (280 chars)…",
              })}
            />
            <NeoButton
              variant="primary"
              size="full"
              disabled={busy || position === null || argument.trim().length === 0}
              onClick={() => {
                if (playerId !== null && position !== null) {
                  onFile(playerId, position, argument);
                }
              }}
            >
              <Gavel size={14} strokeWidth={3} className="mr-1.5" />
              {t("weekend.fileIt", { defaultValue: "File it" })}
            </NeoButton>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Gate = "checking" | "closed" | "open";

export default function CourtScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>("checking");
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasyCourt.getCourtDocket, {})
      .then((docket) => {
        if (!cancelled) setGate(docket === null ? "closed" : "open");
      })
      .catch(() => {
        if (!cancelled) setGate("closed");
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);

  const docket = useQuery(api.fantasyCourt.getCourtDocket, gate === "open" ? {} : "skip");
  const market = useQuery(api.fantasyMarket.getMarket, filing ? {} : "skip");
  const fileClaim = useMutation(api.fantasyCourt.fileClaim);
  const endorseClaim = useMutation(api.fantasyCourt.endorseClaim);
  const castCourtVote = useMutation(api.fantasyCourt.castCourtVote);

  const run = (fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    void fn()
      .catch((e: unknown) => toast.error(friendlyError(e, fallback)))
      .finally(() => setBusy(false));
  };

  const open = docket?.claims.filter((c) => c.status === "filing") ?? [];
  const trials = docket?.claims.filter((c) => c.status === "trial") ?? [];
  const decided =
    docket?.claims.filter(
      (c) =>
        c.status === "passed" ||
        c.status === "failed" ||
        c.status === "died" ||
        c.status === "expired",
    ) ?? [];

  const section = (title: string, claims: CourtClaim[]) =>
    claims.length > 0 &&
    docket != null && (
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {title}
        </p>
        <div className="flex flex-col gap-2">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.claimId}
              claim={claim}
              docket={docket}
              busy={busy}
              onEndorse={() =>
                run(
                  () => endorseClaim({ claimId: claim.claimId }),
                  t("weekend.endorseFailed", { defaultValue: "Could not endorse that." }),
                )
              }
              onVote={(vote) =>
                run(
                  () => castCourtVote({ claimId: claim.claimId, vote }),
                  t("weekend.courtVoteFailed", { defaultValue: "That vote didn't land." }),
                )
              }
            />
          ))}
        </div>
      </div>
    );

  return (
    <ShellLayout
      title={t("weekend.courtTitle", { defaultValue: "Reclamation court" })}
      back
      onBack={() => navigate(SHELL_ROUTES.compete)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
        {gate === "checking" || (gate === "open" && docket === undefined) ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : gate === "closed" || docket == null ? (
          <NeoCard className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.noBoard", { defaultValue: "No board is open right now." })}
            </p>
          </NeoCard>
        ) : (
          <>
            <NeoCard shadow="lg" className="flex items-center justify-between py-3">
              <div>
                <p className="font-heading font-bold">
                  <Scale size={15} strokeWidth={3} className="inline mr-1.5 -mt-0.5" />
                  GW {docket.gwNumber}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {t("weekend.filingsLeft", {
                    defaultValue: "{{left}} of {{max}} filings left",
                    left: Math.max(0, docket.filingsAllowed - docket.myFilings),
                    max: docket.filingsAllowed,
                  })}
                </p>
              </div>
              <NeoButton
                variant="primary"
                size="sm"
                disabled={docket.myFilings >= docket.filingsAllowed}
                onClick={() => setFiling(true)}
              >
                <Gavel size={14} strokeWidth={3} className="mr-1" />
                {t("weekend.fileClaim", { defaultValue: "File a claim" })}
              </NeoButton>
            </NeoCard>

            {docket.claims.length === 0 && (
              <NeoCard className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  {t("weekend.emptyDocket", {
                    defaultValue:
                      "No claims this weekend. See a position the feed got wrong? File it.",
                  })}
                </p>
              </NeoCard>
            )}

            {section(t("weekend.gathering", { defaultValue: "Gathering support" }), open)}
            {section(t("weekend.onTrial", { defaultValue: "On trial" }), trials)}
            {section(t("weekend.decided", { defaultValue: "Decided" }), decided)}

            <FileClaimDialog
              open={filing}
              market={market}
              busy={busy}
              onClose={() => setFiling(false)}
              onFile={(playerId, claimedPosition, argument) => {
                setFiling(false);
                const player = market?.players.find((p) => p.playerId === playerId);
                run(async () => {
                  // The claim needs the fixture: resolve it server-side from
                  // the player's club — the server re-validates everything.
                  const fixtureId = await convex.query(api.fantasyMarket.getFixtureForClub, {
                    clubId: player?.clubId ?? "",
                  });
                  if (fixtureId === null) {
                    throw new Error(
                      t("weekend.noFixtureForClaim", {
                        defaultValue: "No finished match on record for that player.",
                      }),
                    );
                  }
                  return fileClaim({
                    playerId: playerId as Id<"fantasyPlayers">,
                    fixtureId: fixtureId as Id<"fantasyFixtures">,
                    claimedPosition,
                    argument,
                  });
                }, t("weekend.fileFailed", { defaultValue: "Could not file that claim." }));
              }}
            />
          </>
        )}
      </div>
    </ShellLayout>
  );
}
