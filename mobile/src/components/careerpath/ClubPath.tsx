import { CaretDown } from "phosphor-react-native/src/icons/CaretDown";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { WarningCircle } from "phosphor-react-native/src/icons/WarningCircle";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { Text, View } from "react-native";

import { Mono } from "@/components/ui";
import { color, font, radius, space } from "@/theme/tokens";

/** A club is a plain name, or an object that flags a loan spell (app/convex/lib/careerPathClubs.ts). */
export type CareerPathClub = string | { name: string; loan?: boolean };

export const clubName = (c: CareerPathClub) => (typeof c === "string" ? c : c.name);
export const clubIsLoan = (c: CareerPathClub) => typeof c !== "string" && c.loan === true;

/** Same cap the web and the reels use for very long journeyman paths. */
const MAX_ROWS = 12;

function EndTag({ last }: { last: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: space.s,
        paddingVertical: space.xs,
        borderRadius: radius.chip,
        borderWidth: last ? 0 : 1,
        borderColor: color.line,
        backgroundColor: last ? color.cream : "transparent",
      }}
    >
      <Mono s={10} c={last ? color.ink : color.muted} style={{ letterSpacing: 1.2 }}>
        {last ? "LAST CLUB" : "FIRST CLUB"}
      </Mono>
    </View>
  );
}

/**
 * The approved numberless path: one line top to bottom, hollow dot + FIRST CLUB
 * at the start, arrows between clubs, filled dot + LAST CLUB at the end.
 * Every row is the same height so the rhythm never changes with long names.
 */
export function ClubPath({ clubs, rowHeight = 48, fontSize = 20 }: { clubs: CareerPathClub[]; rowHeight?: number; fontSize?: number }) {
  const shown = clubs.length > MAX_ROWS ? [...clubs.slice(0, MAX_ROWS - 1), clubs[clubs.length - 1]] : clubs;
  const hidden = clubs.length - shown.length;
  const mid = rowHeight / 2;
  return (
    <View accessibilityLabel={`Clubs in order: ${clubs.map(clubName).join(", ")}`}>
      {shown.map((club, i) => {
        const first = i === 0;
        const last = i === shown.length - 1;
        return (
          <View key={`${clubName(club)}-${i}`} style={{ height: rowHeight, paddingLeft: space.xxl, flexDirection: "row", alignItems: "center", gap: space.m }}>
            {first || last ? (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: mid - 8,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  borderWidth: last ? 0 : 3,
                  borderColor: color.cream,
                  backgroundColor: last ? color.cream : color.ink,
                }}
              />
            ) : (
              <View style={{ position: "absolute", left: 4, top: mid - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color.dim }} />
            )}
            {!last ? (
              <>
                <View style={{ position: "absolute", left: 7, top: mid + 8, width: 2, height: rowHeight - 16, backgroundColor: color.line }} />
                <View style={{ position: "absolute", left: 2, top: rowHeight - 6 }}>
                  <CaretDown size={12} weight="bold" color={color.dim} />
                </View>
              </>
            ) : null}
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.bold, fontSize, color: color.cream }}>
              {clubName(club)}
            </Text>
            {clubIsLoan(club) ? (
              <Mono s={10} c={color.yellow} style={{ letterSpacing: 1.2 }}>
                LOAN
              </Mono>
            ) : null}
            {first || last ? <EndTag last={last} /> : null}
            {last && hidden > 0 ? <Mono s={11} c={color.dim}>{`+${hidden} more`}</Mono> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Three guess dots: red for each wrong guess, outlined for what's left. */
export function GuessDots({ used, max }: { used: number; max: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }} accessibilityLabel={`Guesses ${used} of ${max} used`}>
      <Mono s={11} c={color.muted} style={{ letterSpacing: 1.5 }}>
        GUESSES
      </Mono>
      {Array.from({ length: max }, (_, i) => (
        <View
          key={i}
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: i < used ? color.wrong : "transparent",
            borderWidth: i < used ? 0 : 2,
            borderColor: color.lineStrong,
          }}
        />
      ))}
    </View>
  );
}

const TIER_LABEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard", impossible: "Impossible" };
export const tierLabel = (d: string) => TIER_LABEL[d] ?? d;

/** Difficulty tag: grey outline, cream mono label (mockup CareerPath / CareerPathLadder). */
export function TierTag({ difficulty }: { difficulty: string }) {
  return (
    <View style={{ alignSelf: "flex-start", borderWidth: 1.5, borderColor: color.lineStrong, borderRadius: radius.chip, paddingHorizontal: space.s, paddingVertical: space.xs }}>
      <Mono s={11} style={{ letterSpacing: 1.5 }}>
        {tierLabel(difficulty).toUpperCase()}
      </Mono>
    </View>
  );
}

/** One-line verdict under the path: wrong (red), close call (yellow), right (green). */
export function VerdictBar({ tone, text }: { tone: "wrong" | "close" | "right"; text: string }) {
  const c = tone === "wrong" ? color.wrong : tone === "right" ? color.right : color.yellow;
  const bg = tone === "wrong" ? color.wrongBg : tone === "right" ? color.rightBg : color.yellowBg;
  return (
    <View accessibilityRole="alert" style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, borderRadius: radius.input, borderWidth: 1.5, borderColor: c, backgroundColor: bg }}>
      {tone === "wrong" ? <XCircle size={20} weight="fill" color={c} /> : tone === "right" ? <CheckCircle size={20} weight="fill" color={c} /> : <WarningCircle size={20} weight="fill" color={c} />}
      <Text maxFontSizeMultiplier={1.3} style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: color.cream }}>{text}</Text>
    </View>
  );
}
