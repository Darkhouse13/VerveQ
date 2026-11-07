import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Hash } from "phosphor-react-native/src/icons/Hash";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Avatar,
  EmptyLine,
  ListCard,
  ListRow,
  NeedsNameCard,
  duelLabel,
  hoursLeft,
  shareDuelLink,
  useNeedsName,
  type DuelSummary,
} from "@/components/duel/common";
import { AppBar, Button, Card, Eyebrow, IconButton, Mono, PillButton, Section, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";

function opponentName(d: DuelSummary) {
  return d.opponent.userId ? d.opponent.username : "Your link";
}

function Stat({ value, label, c = color.cream }: { value: number; label: string; c?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: space.xs }}>
      <Mono s={28} c={c}>
        {value}
      </Mono>
      <Txt v="micro" c={color.muted}>
        {label}
      </Txt>
    </View>
  );
}

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { ready, needsName, user } = useNeedsName();
  const { isAnonymous } = useSession();
  const duels = useQuery(api.duels.listMine, ready && !needsName ? {} : "skip");
  const rivals = useQuery(api.rivalries.listMine, ready && !needsName ? {} : "skip");
  const unread = useQuery(api.notifications.unreadCount, ready ? {} : "skip");

  if (needsName) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Friends" onBack={() => router.back()} />
        <NeedsNameCard next="/friends" />
      </View>
    );
  }

  const me = user?._id;
  const resolved = duels?.resolved ?? [];
  const won = resolved.filter((d) => d.winnerId != null && d.winnerId === me).length;
  const lost = resolved.filter((d) => d.winnerId != null && d.winnerId !== me).length;
  const drawn = resolved.filter((d) => d.winnerId == null && d.status === "resolved").length;

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="Friends"
        eyebrow="Duels · rooms · rivals"
        onBack={() => router.back()}
        right={
          <View>
            <IconButton icon={Bell} label="Notifications" onPress={() => router.push("/inbox")} />
            {unread && unread.count > 0 ? (
              <View style={{ position: "absolute", top: space.xs, right: space.xs, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: color.wrong, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xs }}>
                <Mono s={10} c={color.ink}>
                  {unread.count}
                </Mono>
              </View>
            ) : null}
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xxl }}>
        {/* Record */}
        <Section>
          <Card style={{ flexDirection: "row", paddingVertical: space.gutter }}>
            <Stat value={won} label="Won" c={color.right} />
            <Stat value={lost} label="Lost" />
            <Stat value={drawn} label="Draws" />
          </Card>
          <Button label="New duel" icon={Plus} onPress={() => router.push("/duels/new")} />
        </Section>

        {/* Your turn */}
        <Section eyebrow={`Your turn${duels?.yourTurn.length ? ` · ${duels.yourTurn.length}` : ""}`}>
          {duels && duels.yourTurn.length === 0 ? (
            <EmptyLine icon={Sword} text="No duels waiting on you." />
          ) : (
            <ListCard>
              {(duels?.yourTurn ?? []).map((d, i, arr) => (
                <ListRow
                  key={d.duelId}
                  left={<Avatar name={opponentName(d)} />}
                  title={d.opponentAnsweredCount > 0 ? `${opponentName(d)} played — your turn` : `${opponentName(d)} challenged you`}
                  line={`${duelLabel(d)} · ends in ${hoursLeft(d.expiresAt)}`}
                  right={<PillButton label={d.myAnsweredCount > 0 ? "Resume" : "Play"} onPress={() => router.push(`/duels/${d.duelId}`)} />}
                  onPress={() => router.push(`/duels/${d.duelId}`)}
                  last={i === arr.length - 1}
                />
              ))}
            </ListCard>
          )}
        </Section>

        {/* Waiting on them */}
        {duels && duels.awaiting.length > 0 ? (
          <Section eyebrow="Waiting on them">
            <ListCard>
              {duels.awaiting.map((d, i, arr) => (
                <ListRow
                  key={d.duelId}
                  left={<Avatar name={opponentName(d)} bg={color.surfaceHigh} />}
                  title={d.opponent.userId ? `Waiting on ${d.opponent.username}` : "Link not taken yet"}
                  line={`You scored ${d.myScore} · ends in ${hoursLeft(d.expiresAt)}`}
                  right={
                    d.linkCode && !d.opponent.userId ? (
                      <IconButton icon={Export} label="Share the link again" onPress={() => shareDuelLink(d.linkCode!, d.myScore)} />
                    ) : undefined
                  }
                  onPress={() => router.push(`/duels/${d.duelId}`)}
                  last={i === arr.length - 1}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {/* Live room */}
        <Section eyebrow="Live room">
          <Card style={{ gap: space.l }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.lime }} />
              <Mono s={11} c={color.lime}>
                LIVE
              </Mono>
            </View>
            <View style={{ gap: space.xs }}>
              <Txt v="cardTitle">Play together, right now</Txt>
              <Txt v="caption" c={color.muted}>
                2–5 players, same questions, scored on speed.
              </Txt>
            </View>
            <View style={{ flexDirection: "row", gap: space.m }}>
              <Button label="Create a room" icon={UsersThree} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => router.push("/arena")} />
              <Button variant="secondary" label="Join" icon={Hash} style={{ paddingHorizontal: space.l }} onPress={() => router.push("/arena")} />
            </View>
          </Card>
        </Section>

        {/* Rivals */}
        <Section eyebrow="Rivals">
          {isAnonymous || !rivals || rivals.rivalries.length === 0 ? (
            <Card style={{ gap: space.m }}>
              <Txt v="caption" c={color.muted}>
                {isAnonymous
                  ? "Your record against each friend is kept once you create an account."
                  : "Finish a duel against a friend and they'll show up here."}
              </Txt>
              {isAnonymous ? <Button variant="secondary" label="Create an account" onPress={() => router.push("/create-account" as never)} /> : null}
            </Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }}>
              {rivals.rivalries.map((r) => (
                <Pressable
                  key={r.opponent.userId}
                  onPress={() => {
                    haptic.tap();
                    router.push(`/rivals/${r.opponent.userId}`);
                  }}
                  style={{ width: 120, padding: space.l, gap: space.s, alignItems: "center", backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft }}
                >
                  <Avatar name={r.opponent.username} sz={48} />
                  <Txt v="body" numberOfLines={1}>
                    {r.opponent.username}
                  </Txt>
                  <Mono s={13} c={r.wins >= r.losses ? color.right : color.muted}>{`${r.wins}–${r.losses}`}</Mono>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* Recent */}
        {resolved.length > 0 ? (
          <Section eyebrow="Recent results">
            <ListCard>
              {resolved.slice(0, 8).map((d, i, arr) => {
                const iWon = d.winnerId != null && d.winnerId === me;
                const draw = d.winnerId == null && d.status === "resolved";
                const verdict = d.status === "expired" && !d.opponentCompleted ? "Expired" : draw ? "Draw" : iWon ? "Won" : "Lost";
                return (
                  <ListRow
                    key={d.duelId}
                    left={
                      <View style={{ width: 40, height: 40, borderRadius: radius.tile, backgroundColor: iWon ? color.rightBg : color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
                        {iWon ? <Trophy size={20} weight="fill" color={color.right} /> : <Sword size={20} weight="regular" color={color.muted} />}
                      </View>
                    }
                    title={`${verdict} vs ${opponentName(d)}`}
                    line={`${d.myScore} – ${d.opponentCompleted ? d.opponentScore : "–"} · ${duelLabel(d)}`}
                    onPress={() => router.push(`/duels/${d.duelId}`)}
                    last={i === arr.length - 1}
                  />
                );
              })}
            </ListCard>
          </Section>
        ) : null}
        {duels === undefined ? (
          <Section>
            <Eyebrow>Loading…</Eyebrow>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}
