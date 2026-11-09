import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { Icon } from "phosphor-react-native";
import { GameController } from "phosphor-react-native/src/icons/GameController";
import { Ranking } from "phosphor-react-native/src/icons/Ranking";
import { SoccerBall } from "phosphor-react-native/src/icons/SoccerBall";
import { UserCircle } from "phosphor-react-native/src/icons/UserCircle";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, font, size, space } from "@/theme/tokens";
import { haptic } from "./ui";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: Icon }> = {
  index: { label: "Play", icon: GameController },
  weekend: { label: "Weekend", icon: SoccerBall },
  ranks: { label: "Ranks", icon: Ranking },
  profile: { label: "Profile", icon: UserCircle },
};

/** Material 3 navigation bar, as approved in the mockups (spec §3). */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        height: size.navBar + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: "row",
        backgroundColor: color.navBg,
        borderTopWidth: 1,
        borderTopColor: color.navLine,
      }}
    >
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === i;
        const Ico = tab.icon;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) {
                haptic.tap();
                navigateToTab(route.key);
              }
            }}
            style={{ flex: 1, alignItems: "center", paddingTop: space.m, gap: space.xs }}
          >
            <View
              style={{
                width: 64,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? color.lime : "transparent",
              }}
            >
              <Ico size={24} weight={active ? "fill" : "regular"} color={active ? color.ink : color.muted} />
            </View>
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 12, lineHeight: 16, color: active ? color.cream : color.muted }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
