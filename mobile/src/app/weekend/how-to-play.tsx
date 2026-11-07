import type { Icon } from "phosphor-react-native";
import { Gavel } from "phosphor-react-native/src/icons/Gavel";
import { Scales } from "phosphor-react-native/src/icons/Scales";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { View } from "react-native";

import { Card, Eyebrow, Txt } from "@/components/ui";
import { WeekendScreen } from "@/components/weekend/social";
import { color, font, radius, space } from "@/theme/tokens";

// Copy is the web's (app/src/pages/shell/weekend/WeekendHowToPlayScreen.tsx).
type Item = [label: string, body: string];
const SECTIONS: { title: string; icon: Icon; lead?: string; items: Item[] }[] = [
  {
    title: "The Weekend",
    icon: SoccerBall,
    lead: "One squad for the whole European football weekend. Eight leagues, every fixture in the window counts, and the board resets fresh for each gameweek — weekend windows run Friday through Monday, midweek windows Tuesday through Thursday. No season-long grind.",
    items: [],
  },
  {
    title: "Two ways to play",
    icon: UsersThree,
    items: [
      ["Budget squad.", "Build your own 13 players under a £91.0m budget. Prices run £4.0m–£13.0m in £0.5m steps, identical for everyone and fixed within the gameweek."],
      ["Crew draft.", "2–8 friends, share-code to join, snake draft where every player can be owned once per room. Each drafter gets a chess-clock bank of 30 seconds per round — 390s spent freely across all 13 picks; an empty bank auto-picks the rest."],
    ],
  },
  {
    title: "Your squad",
    icon: SoccerBall,
    items: [
      ["Thirteen players:", "an XI plus 2 finishers (your bench with intent)."],
      ["Any shape that adds up:", "exactly 1 GK, 3–5 DEF, 2–5 MID, 1–3 ATT in the XI. Finishers carry their own position, chosen freely."],
      ["Club cap:", "at most 3 players from one club — 4 from your favorite club. Set it once from the Favorite club card on the Weekend home. It is permanent: it can never be changed, so choose the club you actually support."],
      ["No duplicates:", "a squad is 13 players, not 13 slots."],
    ],
  },
  {
    title: "Locks",
    icon: Scales,
    lead: "Each player locks individually at his own kickoff. Until then swap, re-slot and reshuffle freely; after it, that slot is frozen and the cost committed. A player whose match has already kicked off can't be swapped IN — no hindsight picks. Editing Sunday around a locked Saturday is the intended skill.",
    items: [],
  },
  {
    title: "Scoring, in plain language",
    icon: Trophy,
    items: [
      ["Showing up:", "+1 for any minutes played."],
      ["Goals & assists:", "goals pay +5 to +8 and assists +3 to +6 — the deeper the position, the more they pay (a GK goal is +8, a striker's +5)."],
      ["Team result:", "+1 for a win, +0.5 for a draw, if the player played 60+ minutes."],
      ["Defending:", "clean sheets pay GK +5 / DEF +4 / MID +1 (60+ minutes); GKs and DEFs lose 1 point per 2 goals conceded. Tackles, interceptions, blocks, saves, key passes and dribbles all score small amounts, each capped so volume can't be farmed. Sustained excellence pays via ramps: defenders' duel dominance and midfielders' pass completion each earn up to +2."],
      ["Cards:", "yellow −1, red −4 (a second-yellow dismissal totals −6)."],
      ["Position templates:", "a player scores through the template of the slot YOU fielded him in. If the match verdict says he actually played a different position, a positive score is dampened ×0.75 — mis-slotting never outscores honest slotting."],
      ["Finishers:", "score only from their entry minute onward, and their goals and assists after the 75th minute are multiplied ×1.25 — the decisive-moment multiplier."],
      ["The crowd's verdict:", "head-to-head crowd votes on real performances move a player's score by up to ±15%. Performances with too few votes keep their base score."],
    ],
  },
  {
    title: "The court",
    icon: Gavel,
    lead: "Think the feed called a player's position wrong? File a claim — you get 2 filings per gameweek, and filing counts as the first endorsement. A claim that gathers enough endorsements (at least 15, or 0.5% of the gameweek's actives) goes to trial; a trial passes on a 60% share with quorum (at least 30, or 1%). Filing closes Monday 23:59; verdicts land Tuesday evening and re-score the player before scores go final.",
    items: [],
  },
  {
    title: "Ties & finality",
    icon: Scales,
    items: [
      ["Crew table:", "ranked by cumulative points; equal points are broken by head-to-head weekend wins; still level is a displayed tie."],
      ["Finality:", "scores go final at 23:59 (Paris time) the day after the window closes."],
    ],
  },
];

export default function HowToPlayScreen() {
  return (
    <WeekendScreen title="How to play" eyebrow="The Weekend">
      <View style={{ gap: space.s }}>
        <Txt v="h1Tab">Eight leagues, one squad.</Txt>
      </View>
      {SECTIONS.map((sec) => {
        const Ico = sec.icon;
        return (
          <Card key={sec.title} hero style={{ gap: space.l }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.tile, borderWidth: 1.5, borderColor: color.lime, alignItems: "center", justifyContent: "center" }}>
                <Ico size={20} weight="bold" color={color.lime} />
              </View>
              <Txt v="cardTitle" style={{ flex: 1 }}>
                {sec.title}
              </Txt>
            </View>
            {sec.lead ? <Txt c={color.muted}>{sec.lead}</Txt> : null}
            {sec.items.map(([label, body]) => (
              <Txt key={label} c={color.muted}>
                <Txt c={color.cream} style={{ fontFamily: font.bold }}>{`${label} `}</Txt>
                {body}
              </Txt>
            ))}
          </Card>
        );
      })}
      <Eyebrow>Plain words, same rules as the website.</Eyebrow>
    </WeekendScreen>
  );
}
