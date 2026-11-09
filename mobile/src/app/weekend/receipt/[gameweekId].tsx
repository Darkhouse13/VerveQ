import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Export } from "phosphor-react-native/src/icons/Export";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button } from "@/components/ui";
import { Empty } from "@/components/weekend/common";
import { points } from "@/components/weekend/data";
import { Ledger } from "@/components/weekend/Ledger";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";
import { guardParams, isConvexId } from "@/lib/params";

// The receipt is a cream reading card (docs/BRAND.md: cream is the long-form ground; orange is its action).
const INK = color.ink;
const Line = ({ left, right, dim, bold }: { left: string; right: string; dim?: boolean; bold?: boolean }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.m }}>
    <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, fontFamily: bold ? font.bold : font.medium, fontSize: 15, color: dim ? color.paperDim : INK }} numberOfLines={2}>
      {left}
    </Text>
    <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 15, color: dim ? color.paperDim : INK }}>{right}</Text>
  </View>
);
const Rule = () => <View style={{ height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: color.paperRule }} />;

function ReceiptScreen() {
  const insets = useSafeAreaInsets();
  const { gameweekId } = useLocalSearchParams<{ gameweekId: string }>();
  const { ready } = useSession();
  const receipt = useQuery(api.fantasyReceipts.getReceipt, ready ? { gameweekId: gameweekId as never, context: "budget" } : "skip");
  const [ledger, setLedger] = useState(false);

  if (receipt === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Receipt" onBack={() => router.back()} />
        <ActivityIndicator color={color.lime} style={{ marginTop: space.xxl }} />
      </View>
    );
  }
  if (receipt === null) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Receipt" onBack={() => router.back()} />
        <Empty title="No receipt for this weekend" line="Receipts print once a gameweek settles and you had a squad in it." />
      </View>
    );
  }

  const scored = receipt.slots.filter((s) => s.state === "scored" && s.points !== null && s.playerName).sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const didNot = receipt.slots.filter((s) => s.playerName && (s.state !== "scored" || s.points === null || (s.points === 0 && s.zeroReason)));
  const played = scored.filter((s) => !didNot.includes(s));
  const pct = receipt.percentile && receipt.percentile.population > 1 ? Math.round((receipt.percentile.beatCount / (receipt.percentile.population - 1)) * 100) : null;
  const settled = new Date(receipt.settledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const share = () =>
    void Share.share({
      message: `My VerveQ Weekend — Gameweek ${receipt.gwNumber}: ${points(receipt.total)} pts${pct !== null && pct >= 50 ? `, beat ${pct}% of squads` : ""}.\nPick your 13 → https://verveq.com/weekend`,
    });

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Receipt" eyebrow={`Gameweek ${receipt.gwNumber}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}>
        <View style={{ backgroundColor: color.cream, borderRadius: radius.card, padding: space.gutter, gap: space.l }}>
          <View style={{ gap: space.xs }}>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 11, letterSpacing: 1.5, color: color.paperDim }}>THE WEEKEND — SETTLED</Text>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 24, color: INK }}>{`Gameweek ${receipt.gwNumber} receipt`}</Text>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.medium, fontSize: 13, color: color.paperDim }}>{`${receipt.season} · settled ${settled}`}</Text>
          </View>
          <Rule />
          <View style={{ gap: space.s }}>
            {played.map((s) => (
              <Line key={s.slotIndex} left={`${s.playerName} · ${s.isFinisher ? "finisher" : s.slotRole}`} right={points(s.points ?? 0)} />
            ))}
            {didNot.length ? <Line dim left={`${didNot.map((s) => s.playerName!.split(" ").slice(-1)[0]).join(", ")}`} right="did not play" /> : null}
          </View>
          <Rule />
          <Line bold left="Total" right={`${points(receipt.total)} pts`} />
          {pct !== null && pct >= 50 ? (
            <View style={{ alignSelf: "flex-start", borderWidth: 2, borderColor: color.orange, borderRadius: radius.chip, paddingHorizontal: space.m, paddingVertical: space.s, transform: [{ rotate: "-4deg" }] }}>
              <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 15, color: color.orange }}>{`BEAT ${pct}% OF SQUADS`}</Text>
            </View>
          ) : null}
          {receipt.best || receipt.worst ? <Rule /> : null}
          {receipt.best ? <Line left={`Best call · ${receipt.best.playerName}`} right={points(receipt.best.points)} /> : null}
          {receipt.worst ? <Line left={`Worst call · ${receipt.worst.playerName}`} right={points(receipt.worst.points)} /> : null}
          {receipt.crewRank ? <Line left="Crew table" right={`#${receipt.crewRank.rank} of ${receipt.crewRank.of}`} /> : null}
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.medium, fontSize: 12, color: color.paperDim, textAlign: "center" }}>Every line traces to a stored fact.</Text>
        </View>
        <Button label="Share receipt" icon={Export} onPress={share} />
        <Button variant="secondary" label={ledger ? "Hide the ledger" : "See the full ledger"} onPress={() => setLedger((v) => !v)} />
        {ledger ? <Ledger gameweekId={receipt.gameweekId} /> : null}
      </ScrollView>
    </View>
  );
}

export default guardParams(ReceiptScreen, { gameweekId: isConvexId });
