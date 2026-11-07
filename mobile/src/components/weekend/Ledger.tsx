import { useQuery } from "convex/react";
import { ArrowsClockwise } from "phosphor-react-native/src/icons/ArrowsClockwise";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Gavel } from "phosphor-react-native/src/icons/Gavel";
import { Lock } from "phosphor-react-native/src/icons/Lock";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { Flag } from "phosphor-react-native/src/icons/Flag";
import { ActivityIndicator, View } from "react-native";

import { Mono, Txt } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";

import { points } from "./data";
import { Empty } from "./common";

const time = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** The squad's ledger: every stored fact behind the score, newest first. */
export function Ledger({ gameweekId }: { gameweekId: string }) {
  const ledger = useQuery(api.fantasyLedger.getSquadLedger, { gameweekId: gameweekId as never, context: "budget" });
  if (ledger === undefined) return <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />;
  if (ledger === null) return <Empty title="No ledger yet" line="Build your 13 and every lock, score and change lands here." />;
  const rows = [...ledger.entries].sort((a, b) => b.at - a.at);
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
      {rows.map((e, i) => {
        let Icon = CheckCircle;
        let title = "";
        let line = "";
        let value: string | null = null;
        switch (e.kind) {
          case "squad_built":
            Icon = Flag;
            title = "Squad built";
            line = "Your 13 went in";
            break;
          case "locked":
            Icon = Lock;
            title = e.playerName;
            line = `${e.isFinisher ? "Finisher" : e.slotRole} · locked at kickoff`;
            break;
          case "scored":
            Icon = SoccerBall;
            title = e.playerName;
            line = `${e.isFinisher ? "Finisher" : e.slotRole} · scored${e.crowdFactor !== 1 ? ` · crowd ×${e.crowdFactor.toFixed(2)}` : ""}`;
            value = points(e.points);
            break;
          case "revised":
            Icon = ArrowsClockwise;
            title = e.playerName;
            line = `Revised (${e.cause}) · was ${points(e.prevPoints)}`;
            value = points(e.points);
            break;
          case "court":
            Icon = Gavel;
            title = e.playerName;
            line = `Court moved him to ${e.position}`;
            break;
          case "settled":
            Icon = CheckCircle;
            title = "Gameweek settled";
            line = `${e.scoredSlots} scored`;
            value = points(e.total);
            break;
        }
        return (
          <View
            key={`${e.kind}-${e.at}-${i}`}
            style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: color.lineSoft }}
          >
            <Icon size={20} weight="bold" color={color.muted} />
            <View style={{ flex: 1, gap: space.xs }}>
              <Txt v="rowTitle" numberOfLines={1}>
                {title}
              </Txt>
              <Txt v="caption" c={color.muted}>{`${line} · ${time(e.at)}`}</Txt>
            </View>
            {value ? <Mono s={15}>{value}</Mono> : null}
          </View>
        );
      })}
    </View>
  );
}
