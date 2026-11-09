import type { FunctionReturnType } from "convex/server";
import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { CaretUp } from "phosphor-react-native/src/icons/CaretUp";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Medal } from "phosphor-react-native/src/icons/Medal";
import { Sparkle } from "phosphor-react-native/src/icons/Sparkle";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { useState } from "react";
import { Pressable, Share, View } from "react-native";

import { Button, Card, Eyebrow, Mono, Txt } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";
import { Badge, List, Notice, Segmented, formatPoints } from "./social";

type Dashboard = NonNullable<FunctionReturnType<typeof api.fantasyCrewDashboard.getDashboard>>;
type Scope = Dashboard["season"];

function movementLabel(m: number | null): string | null {
  if (m === null || m === 0) return null;
  return m > 0 ? `↑${m}` : `↓${Math.abs(m)}`;
}

function RaceCard({ scope }: { scope: Scope }) {
  const me = scope.me;
  if (me === null || me.total === null) return null;
  const cell = (value: string, label: string) => (
    <View style={{ flex: 1, alignItems: "center", gap: space.xs }}>
      <Mono s={20}>{value}</Mono>
      <Txt v="micro" c={color.muted}>
        {label}
      </Txt>
    </View>
  );
  return (
    <Card hero style={{ borderColor: color.lime, gap: space.l }}>
      <Eyebrow c={color.lime}>Your crew race</Eyebrow>
      <View style={{ flexDirection: "row" }}>
        {cell(`#${me.rank}`, "position")}
        {cell(me.gapAbove === null ? "—" : formatPoints(me.gapAbove), "to next")}
        {cell(movementLabel(me.movement) ?? "—", "movement")}
      </View>
      <Txt v="caption" c={color.muted} center>
        {`${me.appearances} appearances · ${me.average === null ? "—" : formatPoints(me.average)} average${me.gapBelow === null ? "" : ` · ${formatPoints(me.gapBelow)} ahead`}`}
      </Txt>
    </Card>
  );
}

function Standings({ scope }: { scope: Scope }) {
  if (scope.rows.length === 0) return <Notice title="No standings yet" body="Standings appear once a weekend has been drafted and scored." />;
  return (
    <List>
      {scope.rows.map((row, i) => {
        const move = movementLabel(row.movement);
        return (
          <View
            key={row.userId}
            style={{
              minHeight: 64,
              paddingHorizontal: space.l,
              paddingVertical: space.m,
              flexDirection: "row",
              alignItems: "center",
              gap: space.m,
              borderBottomWidth: i === scope.rows.length - 1 ? 0 : 1,
              borderBottomColor: color.lineSoft,
              backgroundColor: row.isYou ? color.surfaceHigh : "transparent",
            }}
          >
            <Mono s={15} c={color.muted} style={{ width: 32 }}>
              {row.tied ? `T${row.rank}` : `${row.rank}`}
            </Mono>
            <View style={{ flex: 1, gap: space.xs, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                <Txt v="rowTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {row.isYou ? "You" : row.name}
                </Txt>
                {move ? (
                  <Mono s={12} c={(row.movement ?? 0) > 0 ? color.right : color.wrong}>
                    {move}
                  </Mono>
                ) : null}
              </View>
              {row.provisional ? <Eyebrow>Provisional</Eyebrow> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: space.xs }}>
              {row.total === null ? (
                <Txt v="caption" c={color.muted}>
                  {row.provisional ? "awaiting data" : "no drafts yet"}
                </Txt>
              ) : (
                <>
                  <Mono s={15}>{formatPoints(row.total)}</Mono>
                  <Txt v="micro" c={color.muted}>
                    {`${row.appearances} apps · ${row.average === null ? "—" : formatPoints(row.average)} avg`}
                  </Txt>
                </>
              )}
            </View>
          </View>
        );
      })}
    </List>
  );
}

function TrophyCabinet({ scope }: { scope: Scope }) {
  const mine = scope.rows.find((r) => r.isYou);
  if (!mine) return <Notice title="No record yet" body="Your record starts with your first drafted weekend." />;
  const items: [string, string | number][] = [
    ["Weekly wins", mine.weeklyWins],
    ["Podiums", mine.podiums],
    ["Best finish", mine.bestFinish === null ? "—" : `#${mine.bestFinish}`],
    ["Top-half streak", mine.topHalfStreak],
    ["Season titles", mine.seasonTitles],
  ];
  return (
    <View style={{ gap: space.m }}>
      <Eyebrow>Trophy cabinet</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
        {items.map(([label, value]) => (
          <Card key={label} style={{ flexBasis: "47%", flexGrow: 1, alignItems: "center", gap: space.xs }}>
            <Mono s={20}>{String(value)}</Mono>
            <Txt v="micro" c={color.muted}>
              {label}
            </Txt>
          </Card>
        ))}
      </View>
    </View>
  );
}

function WeeklyResults({ scope }: { scope: Scope }) {
  const [open, setOpen] = useState<string | null>(scope.weeks[0]?.roomId ?? null);
  if (scope.weeks.length === 0) return null;
  return (
    <View style={{ gap: space.m }}>
      <Eyebrow>Weekly results</Eyebrow>
      {scope.weeks.map((week) => {
        const expanded = open === week.roomId;
        return (
          <Card key={week.roomId} style={{ gap: space.m }}>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : week.roomId)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                <Txt v="rowTitle">{`GW ${week.gwNumber}`}</Txt>
                <Badge label={week.state === "final" ? "Final" : "Provisional"} tone={week.state === "final" ? "good" : "muted"} />
              </View>
              {expanded ? <CaretUp size={20} weight="bold" color={color.muted} /> : <CaretDown size={20} weight="bold" color={color.muted} />}
            </Pressable>
            {expanded
              ? week.rows.map((row) => (
                  <View key={row.userId} style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                    <Mono s={13} c={color.muted} style={{ width: 32 }}>
                      {row.rank === null ? "—" : row.tied ? `T${row.rank}` : `${row.rank}`}
                    </Mono>
                    <Txt v="body" numberOfLines={1} style={{ flex: 1 }}>
                      {row.name}
                    </Txt>
                    <Mono s={13}>{row.points === null ? "awaiting" : formatPoints(row.points)}</Mono>
                  </View>
                ))
              : null}
          </Card>
        );
      })}
    </View>
  );
}

function Recap({ dashboard }: { dashboard: Dashboard }) {
  const recap = dashboard.recap;
  if (recap === null) return null;
  const share = () => {
    const podium = recap.podium.map((r) => `${r.rank}. ${r.name} ${formatPoints(r.points)}`).join("\n");
    const message = `${dashboard.name} · GW ${recap.gwNumber}\n${podium}${recap.mvp === null ? "" : `\nMVP: ${recap.mvp.playerName} (${formatPoints(recap.mvp.points)})`}`;
    void Share.share({ message });
  };
  const line = (Ico: typeof Medal, text: string, key: string) => (
    <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
      <Ico size={16} weight="fill" color={color.yellow} />
      <Txt v="body" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
  return (
    <Card hero style={{ gap: space.l, borderColor: color.yellow }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.m }}>
        <View style={{ gap: space.xs, flex: 1 }}>
          <Eyebrow c={color.yellow}>{`GW ${recap.gwNumber} recap`}</Eyebrow>
          <Txt v="cardTitle">Weekend wrapped</Txt>
        </View>
        <Button label="Share" variant="secondary" icon={Export} onPress={share} style={{ paddingHorizontal: space.l }} />
      </View>
      <View style={{ gap: space.s }}>
        {recap.podium.map((r) => line(Medal, `#${r.rank} ${r.name} · ${formatPoints(r.points)}`, `p${r.rank}${r.name}`))}
        {recap.biggestClimb !== null ? line(Sparkle, `${recap.biggestClimb.name} climbed ${recap.biggestClimb.places} places`, "climb") : null}
        {recap.mvp !== null ? line(Trophy, `MVP: ${recap.mvp.playerName} · ${formatPoints(recap.mvp.points)} (${recap.mvp.ownerName})`, "mvp") : null}
      </View>
    </Card>
  );
}

export function CrewCompetition({ dashboard }: { dashboard: Dashboard | null | undefined }) {
  const [section, setSection] = useState<"standings" | "record" | "results">("standings");
  const [tab, setTab] = useState<"season" | "allTime">("season");
  if (dashboard === undefined) return <Notice title="Loading standings…" />;
  if (dashboard === null) return null;
  const scope = dashboard[tab];
  return (
    <View style={{ gap: space.l }}>
      <Eyebrow>Crew competition</Eyebrow>
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: "standings", label: "Standings" },
          { value: "record", label: "My record" },
          { value: "results", label: "Weekends" },
        ]}
      />
      {section !== "results" ? (
        <View style={{ flexDirection: "row", gap: space.s }}>
          {(["season", "allTime"] as const).map((key) => {
            const on = tab === key;
            return (
              <Pressable
                hitSlop={8}
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  height: 36,
                  paddingHorizontal: space.l,
                  borderRadius: radius.pill,
                  borderWidth: 1.5,
                  borderColor: on ? color.lime : color.line,
                  justifyContent: "center",
                }}
              >
                <Txt v="micro" c={on ? color.lime : color.muted}>
                  {key === "season" ? dashboard.currentSeason : "All time"}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {section === "standings" ? (
        <>
          <RaceCard scope={scope} />
          <Standings scope={scope} />
          <Txt v="caption" c={color.dim}>
            Season points from each member&apos;s drafted 13. Membership is unlimited; each weekend has eight draft seats.
          </Txt>
        </>
      ) : null}

      {section === "record" ? (
        <>
          <TrophyCabinet scope={scope} />
          {dashboard.rivalries.length > 0 ? (
            <View style={{ gap: space.m }}>
              <Eyebrow>Your rivalries</Eyebrow>
              <List>
                {dashboard.rivalries.slice(0, 5).map((r, i, arr) => (
                  <View
                    key={r.userId}
                    style={{
                      minHeight: 56,
                      paddingHorizontal: space.l,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.m,
                      borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                      borderBottomColor: color.lineSoft,
                    }}
                  >
                    <Sword size={20} weight="bold" color={color.muted} />
                    <Txt v="rowTitle" numberOfLines={1} style={{ flex: 1 }}>
                      {r.name}
                    </Txt>
                    <Mono s={13}>{`${r.wins}–${r.losses}–${r.draws}${r.streak === null ? "" : ` · ${r.streak.result} ${r.streak.length}`}`}</Mono>
                  </View>
                ))}
              </List>
            </View>
          ) : null}
        </>
      ) : null}

      {section === "results" ? (
        <>
          <Recap dashboard={dashboard} />
          <WeeklyResults scope={scope} />
        </>
      ) : null}
    </View>
  );
}
