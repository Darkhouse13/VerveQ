import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Gavel } from "phosphor-react-native/src/icons/Gavel";
import { Scales } from "phosphor-react-native/src/icons/Scales";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Card, Eyebrow, Mono, PillButton, Txt, haptic } from "@/components/ui";
import { Badge, ErrorLine, Field, List, Loading, Notice, Segmented, Sheet, UsernameGate, WeekendScreen, errorText, useNeedsUsername } from "@/components/weekend/social";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import type { Id } from "@convex/_generated/dataModel";
import { color, size, space } from "@/theme/tokens";

type Docket = NonNullable<FunctionReturnType<typeof api.fantasyCourt.getCourtDocket>>;
type Claim = Docket["claims"][number];
type Market = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getMarket>>;
type Role = "GK" | "DEF" | "MID" | "ATT";
const ROLES: Role[] = ["GK", "DEF", "MID", "ATT"];

const STATUS: Record<Claim["status"], { label: string; tone: "warn" | "lime" | "good" | "bad" | "muted" }> = {
  filing: { label: "Gathering", tone: "warn" },
  trial: { label: "On trial", tone: "lime" },
  passed: { label: "Passed", tone: "good" },
  failed: { label: "Failed", tone: "bad" },
  died: { label: "Died", tone: "muted" },
  expired: { label: "Expired", tone: "muted" },
};

function ClaimCard({ claim, docket, busy, onEndorse, onVote }: { claim: Claim; docket: Docket; busy: boolean; onEndorse: () => void; onVote: (v: "yes" | "no") => void }) {
  const st = STATUS[claim.status];
  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.m }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Txt v="rowTitle">{claim.playerName}</Txt>
          <Mono s={12} c={color.muted}>{`${claim.positionAtFiling ?? "?"} → ${claim.claimedPosition}`}</Mono>
        </View>
        <Badge label={st.label} tone={st.tone} />
      </View>
      <Txt>{`“${claim.argument}”`}</Txt>
      {claim.rebuttal !== null ? <Txt v="caption" c={color.muted}>{`Rebuttal: “${claim.rebuttal}”`}</Txt> : null}

      {claim.status === "filing" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.m }}>
          <Mono s={12} c={color.muted}>{`${claim.endorsements} / ${docket.endorsementThreshold} endorsements`}</Mono>
          {!claim.myEndorsement && !claim.filedByMe ? <PillButton label="Deserves a hearing" outline onPress={busy ? undefined : onEndorse} /> : null}
        </View>
      ) : null}

      {claim.status === "trial" ? (
        <View style={{ gap: space.m }}>
          <Mono s={12} c={color.muted}>{`QUORUM ${docket.quorum} · 60% TO PASS`}</Mono>
          {claim.myVote === null && !claim.filedByMe ? (
            <View style={{ flexDirection: "row", gap: space.m }}>
              <Button label="He did" style={{ flex: 1, height: size.buttonSecondary }} disabled={busy} onPress={() => onVote("yes")} />
              <Button label="Feed's right" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => onVote("no")} />
            </View>
          ) : claim.myVote !== null ? (
            <Badge label={`Voted ${claim.myVote}`} />
          ) : null}
        </View>
      ) : null}

      {claim.tallies !== null && (claim.status === "passed" || claim.status === "failed") ? (
        <Mono s={12} c={color.muted}>
          {`${claim.tallies.weightedYes.toFixed(1)}–${claim.tallies.weightedNo.toFixed(1)} weighted (${claim.tallies.rawYes}–${claim.tallies.rawNo} raw, ${claim.tallies.rawVotes} jurors)`}
        </Mono>
      ) : null}
      {claim.status === "expired" ? (
        <Txt v="caption" c={color.muted}>
          Unresolved at finality — no ruling applied, no score moved.
        </Txt>
      ) : null}
    </Card>
  );
}

function FileClaimSheet({ open, market, busy, onFile, onClose }: { open: boolean; market: Market | null | undefined; busy: boolean; onFile: (playerId: string, role: Role, argument: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("MID");
  const [argument, setArgument] = useState("");
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!market || needle.length < 2) return [];
    return market.players.filter((p) => p.name.toLowerCase().includes(needle) || (p.clubName ?? "").toLowerCase().includes(needle)).slice(0, 8);
  }, [market, search]);
  const selected = market?.players.find((p) => p.playerId === playerId) ?? null;

  return (
    <Sheet open={open} onClose={onClose} title="File a claim">
      {selected === null ? (
        <>
          <Field value={search} onChangeText={setSearch} placeholder="Which player?" autoCorrect={false} autoFocus />
          {market === undefined ? <Txt c={color.muted}>Loading players…</Txt> : null}
          <List>
            {results.map((p, i) => (
              <Pressable accessibilityRole="button"
                key={p.playerId}
                onPress={() => {
                  haptic.tap();
                  setPlayerId(p.playerId);
                  setRole(ROLES.find((r) => r !== p.position) ?? "MID");
                }}
                style={{ minHeight: size.listRow, paddingHorizontal: space.l, flexDirection: "row", alignItems: "center", gap: space.m, borderBottomWidth: i === results.length - 1 ? 0 : 1, borderBottomColor: color.lineSoft }}
              >
                <Txt v="rowTitle" numberOfLines={1} style={{ flex: 1 }}>
                  {p.name}
                </Txt>
                <Mono s={11} c={color.muted}>{`${p.position} · ${(p.clubName ?? p.clubId).toUpperCase()}`}</Mono>
              </Pressable>
            ))}
          </List>
        </>
      ) : (
        <>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
            <Txt v="rowTitle" style={{ flex: 1 }}>
              {selected.name}
            </Txt>
            <PillButton label="Change" outline onPress={() => setPlayerId(null)} />
          </Card>
          <Eyebrow>He actually played…</Eyebrow>
          <Segmented value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: r }))} />
          <Field value={argument} onChangeText={setArgument} maxLength={280} placeholder="Your one-line case (280 chars)…" />
          <Button label="File it" icon={Gavel} disabled={busy || argument.trim().length === 0} onPress={() => onFile(selected.playerId, role, argument.trim())} />
        </>
      )}
    </Sheet>
  );
}

export default function CourtScreen() {
  const { ready } = useSession();
  const needsName = useNeedsUsername();
  const convex = useConvex();
  const [gate, setGate] = useState<"checking" | "closed" | "open">("checking");
  const [busy, setBusy] = useState(false);
  const [filing, setFiling] = useState(false);
  const [filingKey, setFilingKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    convex
      .query(api.fantasyCourt.getCourtDocket, {})
      .then((d) => !cancelled && setGate(d === null ? "closed" : "open"))
      .catch(() => !cancelled && setGate("closed"));
    return () => {
      cancelled = true;
    };
  }, [convex, ready]);

  const docket = useQuery(api.fantasyCourt.getCourtDocket, gate === "open" ? {} : "skip");
  const market = useQuery(api.fantasyMarket.getMarket, filing ? { fixtureOnly: true } : "skip");
  const fileClaim = useMutation(api.fantasyCourt.fileClaim);
  const endorse = useMutation(api.fantasyCourt.endorseClaim);
  const castVote = useMutation(api.fantasyCourt.castCourtVote);

  const run = (fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void fn()
      .catch((e: unknown) => setError(errorText(e, fallback)))
      .finally(() => setBusy(false));
  };

  const sections: [string, Claim[]][] = docket
    ? [
        ["Gathering support", docket.claims.filter((c) => c.status === "filing")],
        ["On trial", docket.claims.filter((c) => c.status === "trial")],
        ["Decided", docket.claims.filter((c) => c.status !== "filing" && c.status !== "trial")],
      ]
    : [];

  return (
    <WeekendScreen title="Player court" eyebrow={docket ? `GW ${docket.gwNumber}` : "The Weekend"}>
      {needsName ? (
        <UsernameGate what="on the claims you file and back" />
      ) : gate === "checking" || (gate === "open" && docket === undefined) ? (
        <Loading />
      ) : gate === "closed" || !docket ? (
        <Notice title="No board is open right now." />
      ) : (
        <>
          <Card hero style={{ flexDirection: "row", alignItems: "center", gap: space.l, borderColor: color.lime }}>
            <Scales size={32} weight="regular" color={color.lime} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle">Feed got a position wrong?</Txt>
              <Txt v="caption" c={color.muted}>{`${Math.max(0, docket.filingsAllowed - docket.myFilings)} of ${docket.filingsAllowed} filings left`}</Txt>
            </View>
          </Card>
          <Button label="File a claim" icon={Gavel} disabled={docket.myFilings >= docket.filingsAllowed} onPress={() => {
              setFilingKey((k) => k + 1);
              setFiling(true);
            }} />
          <ErrorLine text={error} />
          {docket.claims.length === 0 ? <Notice title="No claims this weekend." body="See a position the feed got wrong? File it." /> : null}
          {sections.map(([title, claims]) =>
            claims.length > 0 ? (
              <View key={title} style={{ gap: space.m }}>
                <Eyebrow>{title}</Eyebrow>
                {claims.map((c) => (
                  <ClaimCard
                    key={c.claimId}
                    claim={c}
                    docket={docket}
                    busy={busy}
                    onEndorse={() => run(() => endorse({ claimId: c.claimId }), "Could not endorse that.")}
                    onVote={(v) => run(() => castVote({ claimId: c.claimId, vote: v }), "That vote didn't land.")}
                  />
                ))}
              </View>
            ) : null,
          )}
          <FileClaimSheet
            key={filingKey}
            open={filing}
            market={market}
            busy={busy}
            onClose={() => setFiling(false)}
            onFile={(playerId, claimedPosition, argument) => {
              setFiling(false);
              const player = market?.players.find((p) => p.playerId === playerId);
              run(async () => {
                const fixtureId = await convex.query(api.fantasyMarket.getFixtureForClub, { clubId: player?.clubId ?? "" });
                if (fixtureId === null) throw new Error("No finished match on record for that player.");
                return fileClaim({
                  playerId: playerId as Id<"fantasyPlayers">,
                  fixtureId: fixtureId as Id<"fantasyFixtures">,
                  claimedPosition,
                  argument,
                });
              }, "Could not file that claim.");
            }}
          />
        </>
      )}
    </WeekendScreen>
  );
}
