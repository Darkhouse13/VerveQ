import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { BellSimpleSlash } from "phosphor-react-native/src/icons/BellSimpleSlash";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListCard, ListRow, hoursLeft, type DuelSummary } from "@/components/duel/common";
import { AppBar, Card, Section, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";

// The backend has no list query for challengeNotifications (only unreadCount +
// markAllRead), so the inbox is built from the same duel state those
// notifications describe: duels waiting on you, ones about to expire, and
// fresh results (duel_resolved / duel_near_expiry / opponent_beat_score).
const NEAR_EXPIRY_MS = 6 * 60 * 60 * 1000;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

type Item = { key: string; icon: Icon; tint: string; title: string; line: string; at: number; duelId: DuelSummary["duelId"] };

function ago(ts: number) {
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { ready, user } = useSession();
  const duels = useQuery(api.duels.listMine, ready ? {} : "skip");
  const unread = useQuery(api.notifications.unreadCount, ready ? {} : "skip");
  const markAllRead = useMutation(api.notifications.markAllRead);

  useEffect(() => {
    if (unread && unread.count > 0) markAllRead({}).catch(() => {});
  }, [unread, markAllRead]);

  const [now] = useState(() => Date.now());
  const name = (d: DuelSummary) => (d.opponent.userId ? d.opponent.username : "Your link opponent");
  const items: Item[] = [];
  for (const d of duels?.yourTurn ?? []) {
    const soon = d.expiresAt - now < NEAR_EXPIRY_MS;
    items.push({
      key: `turn-${d.duelId}`,
      icon: soon ? Hourglass : Sword,
      tint: soon ? color.orange : color.lime,
      title: soon ? `Your duel with ${name(d)} ends soon` : d.opponentAnsweredCount > 0 ? `${name(d)} played — your turn` : `${name(d)} challenged you`,
      line: `Ends in ${hoursLeft(d.expiresAt)}`,
      at: d.createdAt,
      duelId: d.duelId,
    });
  }
  for (const d of duels?.awaiting ?? []) {
    if (d.opponentAnsweredCount > 0 && d.opponentScore > d.myScore) {
      items.push({ key: `beat-${d.duelId}`, icon: XCircle, tint: color.wrong, title: `${name(d)} passed your score`, line: `${d.opponentScore} vs your ${d.myScore}`, at: d.createdAt, duelId: d.duelId });
    }
  }
  for (const d of duels?.resolved ?? []) {
    const at = d.resolvedAt ?? d.createdAt;
    if (now - at > RECENT_MS) continue;
    const iWon = d.winnerId != null && d.winnerId === user?._id;
    const expired = d.status === "expired" && !d.opponentCompleted;
    items.push({
      key: `res-${d.duelId}`,
      icon: iWon ? Trophy : expired ? Hourglass : Sword,
      tint: iWon ? color.right : color.muted,
      title: expired ? `Your duel expired` : iWon ? `You beat ${name(d)}` : d.winnerId == null ? `Draw with ${name(d)}` : `${name(d)} won your duel`,
      line: `${d.myScore} – ${d.opponentCompleted ? d.opponentScore : "–"} · ${ago(at)}`,
      at,
      duelId: d.duelId,
    });
  }
  items.sort((a, b) => b.at - a.at);

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Notifications" eyebrow={unread && unread.count > 0 ? `${unread.count} unread` : undefined} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl }}>
        <Section>
          {duels && items.length === 0 ? (
            <Card style={{ alignItems: "center", gap: space.m, paddingVertical: space.xxl }}>
              <BellSimpleSlash size={32} weight="regular" color={color.dim} />
              <Txt c={color.muted} center>
                Nothing new. Duel results and challenges show up here.
              </Txt>
            </Card>
          ) : (
            <ListCard>
              {items.map((it, i) => {
                const Ico = it.icon;
                return (
                  <ListRow
                    key={it.key}
                    left={
                      <View style={{ width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
                        <Ico size={20} weight="fill" color={it.tint} />
                      </View>
                    }
                    title={it.title}
                    line={it.line}
                    onPress={() => router.push(`/duels/${it.duelId}`)}
                    last={i === items.length - 1}
                  />
                );
              })}
            </ListCard>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}
