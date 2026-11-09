import type { FunctionReturnType } from "convex/server";
import { Check } from "phosphor-react-native/src/icons/Check";
import { CheckSquare } from "phosphor-react-native/src/icons/CheckSquare";
import { EyeSlash } from "phosphor-react-native/src/icons/EyeSlash";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Square } from "phosphor-react-native/src/icons/Square";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Button, Card, Eyebrow, Mono, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";
import { Notice, leagueName } from "./social";

export type ServeResult = FunctionReturnType<typeof api.fantasyCrowdVoting.servePair>;
export type ServedPair = Extract<ServeResult, { status: "served" }>;
export type CastVoteResult = FunctionReturnType<typeof api.fantasyCrowdVoting.castVote>;
export type ConsensusReveal = NonNullable<CastVoteResult["reveal"]>;
export type PickerFixture = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getWeekendFixtures>>["fixtures"][number];
export type VoteChoice = "a" | "b" | "unseen_a" | "unseen_b" | "skip";

export const REVEAL_BEAT_MS = 1100;
export const CROWD_UNDO_WINDOW_MS = 5_000; // convex/lib/fantasyCrowd.ts

export function localDayStart(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const ROLE_WORD: Record<string, string> = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", ATT: "Attacker" };

// ── Fixture picker ("which games did you catch?") ──────────────────────────

function groupByDay<F extends { kickoffAt: number }>(fixtures: readonly F[]) {
  const groups = new Map<number, F[]>();
  for (const f of fixtures) {
    const d = new Date(f.kickoffAt);
    d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([dayStart, list]) => ({ dayStart, fixtures: [...list].sort((a, b) => a.kickoffAt - b.kickoffAt) }));
}

export function FixturePicker({
  fixtures,
  selected,
  unseen,
  busy,
  editing,
  onToggle,
  onContinue,
}: {
  fixtures: readonly PickerFixture[];
  selected: ReadonlySet<string>;
  unseen: ReadonlySet<string>;
  busy: boolean;
  editing: boolean;
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  const days = groupByDay(fixtures);
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.s }}>
        <Txt v="h1Game">Which games did you catch this weekend?</Txt>
        <Txt c={color.muted}>We&apos;ll only ask about players you actually saw.</Txt>
      </View>
      {days.map((day) => (
        <View key={day.dayStart} style={{ gap: space.m }}>
          <Eyebrow>{new Date(day.dayStart).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</Eyebrow>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
            {day.fixtures.map((f, i) => {
              const on = selected.has(f.fixtureId);
              const retired = unseen.has(f.fixtureId);
              const tail = retired ? " · you didn't see this one" : f.status === "finished" ? "" : " · not finished";
              return (
                <Pressable
                  key={f.fixtureId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: retired }}
                  disabled={retired || busy}
                  onPress={() => {
                    haptic.tap();
                    onToggle(f.fixtureId);
                  }}
                  style={{
                    minHeight: size.listRow,
                    paddingHorizontal: space.l,
                    paddingVertical: space.m,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.m,
                    borderBottomWidth: i === day.fixtures.length - 1 ? 0 : 1,
                    borderBottomColor: color.lineSoft,
                    opacity: retired ? 0.45 : 1,
                  }}
                >
                  {on ? <CheckSquare size={24} weight="fill" color={color.lime} /> : <Square size={24} weight="regular" color={color.muted} />}
                  <View style={{ flex: 1, gap: space.xs }}>
                    <Txt v="rowTitle">{`${f.homeName ?? f.homeClubId} v ${f.awayName ?? f.awayClubId}`}</Txt>
                    <Mono s={11} c={color.muted}>
                      {`${leagueName(f.leagueId).toUpperCase()}${tail.toUpperCase()}`}
                    </Mono>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Button label={selected.size === 0 ? "I didn't watch any" : editing ? "Save" : "Continue"} variant={selected.size === 0 ? "secondary" : "primary"} disabled={busy} onPress={onContinue} />
    </View>
  );
}

// ── Pair card ───────────────────────────────────────────────────────────────

function PairCard({ player, busy, onPick }: { player: ServedPair["players"][number]; busy: boolean; onPick: () => void }) {
  const p = player as ServedPair["players"][number] & { minutes?: number; goals?: number; assists?: number; redCard?: boolean };
  const { fixture } = p;
  const club = p.clubName ?? p.clubId;
  const opponent = p.opponentName ?? p.opponentClubId;
  const events: string[] = [];
  if ((p.goals ?? 0) > 0) events.push(`${p.goals} goal${p.goals === 1 ? "" : "s"}`);
  if ((p.assists ?? 0) > 0) events.push(`${p.assists} assist${p.assists === 1 ? "" : "s"}`);
  if (p.redCard) events.push("red card");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name} had the better game`}
      disabled={busy}
      onPress={() => {
        haptic.tap();
        onPick();
      }}
      style={({ pressed }) => ({
        backgroundColor: color.surface,
        borderRadius: radius.hero,
        borderWidth: 1.5,
        borderColor: pressed ? color.lime : color.line,
        padding: space.gutter,
        gap: space.s,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: busy ? 0.6 : 1,
      })}
    >
      <Eyebrow>{ROLE_WORD[p.position] ?? p.position}</Eyebrow>
      <Txt v="h1Game" numberOfLines={1}>
        {p.name}
      </Txt>
      <Txt c={color.muted}>{`${club} · ${p.isHome ? "v" : "at"} ${opponent}`}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m, flexWrap: "wrap" }}>
        {p.minutes !== undefined ? <Mono s={13} c={color.muted}>{`${p.minutes}'`}</Mono> : null}
        {events.length > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <SoccerBall size={16} weight="fill" color={color.cream} />
            <Txt v="micro">{events.join(" · ")}</Txt>
          </View>
        ) : null}
        <Mono s={11} c={color.dim}>{`${leagueName(fixture.leagueId).toUpperCase()}`}</Mono>
      </View>
    </Pressable>
  );
}

// ── The stack ───────────────────────────────────────────────────────────────

function Ghost({ label, icon, onPress, disabled }: { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: size.buttonSecondary,
        borderRadius: size.buttonSecondary / 2,
        borderWidth: 1.5,
        borderColor: color.line,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.s,
        paddingHorizontal: space.m,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon}
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: color.cream }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VoteStack({ serve, busy, onVote, onEditPicker }: { serve: ServeResult; busy: boolean; onVote: (c: VoteChoice) => void; onEditPicker: () => void }) {
  const addGames = <Button label="Add games" variant="secondary" icon={Plus} disabled={busy} onPress={onEditPicker} />;
  if (serve.status === "closed") return <Notice title="Voting is closed right now." body="The stack opens as matches finish and closes when the weekend settles." />;
  if (serve.status === "no_fixtures")
    return (
      <View style={{ gap: space.m }}>
        <Notice title="Nothing to judge, then." body="No games picked this weekend — that's a fine answer. Add one whenever you catch it." />
        {addGames}
      </View>
    );
  if (serve.status === "cap_reached") return <Notice title="That's this weekend's limit." body={`${serve.served} pairs served — thank you for the eyes.`} tone="good" />;
  if (serve.status === "exhausted")
    return (
      <View style={{ gap: space.m }}>
        <Notice title="No more pairs for now." body="Come back after the next matches finish." />
        {addGames}
      </View>
    );
  if (serve.status === "needs_picker") return <Notice title="No board is open right now." />;

  const [a, b] = serve.players;
  const cascade = a.fixtureId !== undefined && b.fixtureId !== undefined;
  const sameFixture = cascade && a.fixtureId === b.fixtureId;
  const progress = (serve as { progress?: { voted: number; goal: number } }).progress;
  const fx = a.fixture;
  const score = fx.homeGoals === null || fx.awayGoals === null ? null : `${fx.homeGoals}–${fx.awayGoals}`;

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.s, alignItems: "center" }}>
        {sameFixture ? (
          <Mono s={12} c={color.muted}>
            {`${(a.isHome ? a.clubName ?? a.clubId : a.opponentName ?? a.opponentClubId)?.toUpperCase()} ${score ?? "v"} ${(a.isHome ? a.opponentName ?? a.opponentClubId : a.clubName ?? a.clubId)?.toUpperCase()} · ${new Date(fx.kickoffAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}`}
          </Mono>
        ) : null}
        <Txt v="h1Game" center>
          Who had the better game?
        </Txt>
      </View>
      <View style={{ gap: space.m }}>
        <PairCard player={a} busy={busy} onPick={() => onVote("a")} />
        <PairCard player={b} busy={busy} onPick={() => onVote("b")} />
      </View>
      {cascade ? (
        <View style={{ gap: space.m }}>
          {sameFixture ? (
            <Ghost label="Didn't see this game" icon={<EyeSlash size={20} weight="bold" color={color.cream} />} disabled={busy} onPress={() => onVote("skip")} />
          ) : null}
          <View style={{ flexDirection: "row", gap: space.m }}>
            <Ghost label={`Didn't see ${a.name.split(" ").slice(-1)[0]}`} icon={<EyeSlash size={16} weight="bold" color={color.muted} />} disabled={busy} onPress={() => onVote("unseen_a")} />
            <Ghost label={`Didn't see ${b.name.split(" ").slice(-1)[0]}`} icon={<EyeSlash size={16} weight="bold" color={color.muted} />} disabled={busy} onPress={() => onVote("unseen_b")} />
          </View>
        </View>
      ) : (
        <Ghost label="Didn't watch" icon={<EyeSlash size={20} weight="bold" color={color.cream} />} disabled={busy} onPress={() => onVote("skip")} />
      )}
      <View style={{ gap: space.s }}>
        <Txt v="caption" c={color.muted} center>
          Tap the player who played better. You&apos;ll see where the crowd landed after you vote.
        </Txt>
        {progress ? (
          <Mono s={12} c={color.dim} style={{ textAlign: "center" }}>
            {`${Math.min(progress.voted, progress.goal)} OF ${progress.goal}`}
          </Mono>
        ) : null}
      </View>
    </View>
  );
}

// ── After the vote ──────────────────────────────────────────────────────────

export function RevealCard({ reveal }: { reveal: ConsensusReveal }) {
  const first = reveal.lowSample || reveal.percent === null;
  const pct = reveal.percent ?? 0;
  const withCrowd = !first && reveal.majority;
  return (
    <Card hero style={{ alignItems: "center", gap: space.l, paddingVertical: space.xxl, borderColor: withCrowd ? color.right : color.lineSoft, backgroundColor: withCrowd ? color.rightBg : color.surface }}>
      <Txt v="cardTitle" center>
        {first ? "You're one of the first on this one." : withCrowd ? `${pct}% went with you` : `You're with the ${pct}%`}
      </Txt>
      {!first ? (
        <View style={{ alignSelf: "stretch", height: 8, borderRadius: 4, backgroundColor: color.line, overflow: "hidden" }}>
          <View style={{ width: `${pct}%`, height: 8, backgroundColor: withCrowd ? color.right : color.lime }} />
        </View>
      ) : null}
    </Card>
  );
}

export function DoneCard({ exhausted, onKeepGoing }: { exhausted: boolean; onKeepGoing: () => void }) {
  return (
    <View style={{ gap: space.l }}>
      <Card hero style={{ alignItems: "center", gap: space.m, paddingVertical: space.xxl, borderColor: color.right, backgroundColor: color.rightBg }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.right, alignItems: "center", justifyContent: "center" }}>
          <Check size={24} weight="bold" color={color.ink} />
        </View>
        <Txt v="cardTitle" center>
          {exhausted ? "That's every game you picked." : "That's today's ten."}
        </Txt>
        <Txt c={color.muted}>The crowd thanks you.</Txt>
      </Card>
      {!exhausted ? <Button label="Keep going — extra pairs just help" variant="ghost" onPress={onKeepGoing} /> : null}
    </View>
  );
}
