import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { Fire } from "phosphor-react-native/src/icons/Fire";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, ListCard, ListRow, duelLabel, type DuelSummary } from "@/components/duel/common";
import { AppBar, Button, Card, Eyebrow, Mono, Section, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";
import { guardParams, isConvexId } from "@/lib/params";

type UserId = NonNullable<DuelSummary["opponent"]["userId"]>;

function RivalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const opponentUserId = id as UserId;
  const insets = useSafeAreaInsets();
  const { ready, user, isAnonymous } = useSession();
  const rival = useQuery(api.rivalries.get, ready ? { opponentUserId } : "skip");
  const duels = useQuery(api.duels.listMine, ready ? {} : "skip");
  const rematch = useMutation(api.duels.rematch);
  const [error, setError] = useState<string | null>(null);

  const past = (duels?.resolved ?? []).filter((d) => d.opponent.userId === opponentUserId);
  const name = rival?.opponent?.username ?? past[0]?.opponent.username ?? "Rival";

  // rivalries.get returns null unless both players have full accounts
  // (docs/OPEN_BUGS.md #2) — explain instead of showing an empty record.
  if (rival === null) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title={name} eyebrow="Rival" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.l }}>
          <Txt v="h1Game">Records are for accounts</Txt>
          <Txt c={color.muted}>
            {isAnonymous || !user?.email
              ? "Create an account to keep your win–loss record against each friend."
              : `${name} doesn't have an account yet, so there's no record to keep.`}
          </Txt>
          {isAnonymous || !user?.email ? <Button label="Create an account" onPress={() => router.push("/create-account" as never)} /> : null}
          <Button variant="secondary" label="New duel" icon={Plus} onPress={() => router.push("/duels/new")} />
        </View>
      </View>
    );
  }

  const streakMine = rival?.currentStreakHolderId === user?._id;

  async function doRematch() {
    const last = rival?.lastDuelId ?? past[0]?.duelId;
    if (!last) return router.push("/duels/new");
    try {
      const r = await rematch({ duelId: last });
      router.push(`/duels/${r.duelId}`);
    } catch {
      setError("Couldn't start a rematch");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={name} eyebrow="Rival" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: space.xxl, gap: space.xxl }}>
        <Section>
          <View style={{ alignItems: "center", gap: space.m }}>
            <Avatar name={name} sz={64} />
            <Txt v="h1Game">{`You vs ${name}`}</Txt>
          </View>
          <Card style={{ flexDirection: "row", paddingVertical: space.gutter }}>
            {[
              { v: rival?.wins ?? 0, l: "Won", c: color.right },
              { v: rival?.losses ?? 0, l: "Lost", c: color.cream },
              { v: rival?.draws ?? 0, l: "Draws", c: color.cream },
            ].map((x) => (
              <View key={x.l} style={{ flex: 1, alignItems: "center", gap: space.xs }}>
                <Mono s={32} c={x.c}>
                  {x.v}
                </Mono>
                <Txt v="micro" c={color.muted}>
                  {x.l}
                </Txt>
              </View>
            ))}
          </Card>
          {rival && rival.currentStreakLen > 1 ? (
            <Card style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <Fire size={20} weight="fill" color={color.yellow} />
              <Txt v="body" style={{ flex: 1 }}>
                {streakMine ? `You've won the last ${rival.currentStreakLen}` : `${name} has won the last ${rival.currentStreakLen}`}
              </Txt>
            </Card>
          ) : null}
        </Section>

        <Section eyebrow="Past duels">
          {past.length === 0 ? (
            <Card>
              <Txt v="caption" c={color.muted}>
                No finished duels in your recent history.
              </Txt>
            </Card>
          ) : (
            <ListCard>
              {past.map((d, i, arr) => {
                const iWon = d.winnerId != null && d.winnerId === user?._id;
                return (
                  <ListRow
                    key={d.duelId}
                    left={
                      <View style={{ width: 40, height: 40, borderRadius: radius.tile, backgroundColor: iWon ? color.rightBg : color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
                        {iWon ? <Trophy size={20} weight="fill" color={color.right} /> : <Sword size={20} weight="regular" color={color.muted} />}
                      </View>
                    }
                    title={`${d.myScore} – ${d.opponentCompleted ? d.opponentScore : "–"}`}
                    line={duelLabel(d)}
                    onPress={() => router.push(`/duels/${d.duelId}`)}
                    last={i === arr.length - 1}
                  />
                );
              })}
            </ListCard>
          )}
        </Section>
        {error ? (
          <Section>
            <Eyebrow c={color.wrong}>{error}</Eyebrow>
          </Section>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
        <Button label="Rematch" icon={ArrowClockwise} onPress={doRematch} />
        <Button variant="secondary" label="New duel" icon={Plus} onPress={() => router.push("/duels/new")} />
      </View>
    </View>
  );
}

export default guardParams(RivalScreen, { id: isConvexId });
