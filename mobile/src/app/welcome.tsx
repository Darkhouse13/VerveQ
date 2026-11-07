import { router } from "expo-router";
import type { Icon } from "phosphor-react-native";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { Brain } from "phosphor-react-native/src/icons/Brain";
import { Heart } from "phosphor-react-native/src/icons/Heart";
import { TextAa } from "phosphor-react-native/src/icons/TextAa";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { markWelcomeSeen } from "@/components/account/welcomeFlag";
import { BrandLockup } from "@/components/BrandLockup";
import { Button, Eyebrow, Txt } from "@/components/ui";
import { color, modeAccent, radius, space } from "@/theme/tokens";

const TODAY: { icon: Icon; bg: string }[] = [
  { icon: UsersThree, bg: modeAccent.whosOlder },
  { icon: TextAa, bg: modeAccent.missingLetters },
  { icon: Brain, bg: modeAccent.dailyQuiz },
  { icon: Heart, bg: modeAccent.dailySurvival },
];

/** First open only (flag in SecureStore). Anonymous-first: playing needs no sign-up. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.ink, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: space.gutter }}>
      <BrandLockup height={48} />
      <View style={{ flex: 1, justifyContent: "center", gap: space.xl }}>
        <View style={{ gap: space.m }}>
          <Eyebrow>Football games · new every day</Eyebrow>
          <Txt v="h1Tab">Prove your football IQ</Txt>
          <Txt c={color.muted}>Four quick games every day, the same for everyone. Play them, keep your streak, and challenge your friends.</Txt>
        </View>
        <View style={{ flexDirection: "row", gap: space.m }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {TODAY.map(({ icon: Ico, bg }, i) => (
            <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: radius.card, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
              <Ico size={32} weight="fill" color={color.ink} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: space.m }}>
        <Button
          label="Play today's games"
          icon={ArrowRight}
          iconRight
          onPress={() => {
            markWelcomeSeen();
            router.replace("/");
          }}
        />
        <Txt v="caption" c={color.dim} center>
          Free · no sign-up
        </Txt>
        <Button
          variant="ghost"
          label="I have an account"
          onPress={() => {
            markWelcomeSeen();
            router.replace("/sign-in");
          }}
        />
      </View>
    </View>
  );
}
