import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Bell } from "phosphor-react-native/src/icons/Bell";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { useEffect, useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Card, Eyebrow, Txt, haptic } from "@/components/ui";
import { color, font, radius, space } from "@/theme/tokens";

// Push delivery lands in the next build; for now the choice is kept on the
// phone so the push work can pick it up (keys read by the notifications module).
export const REMINDER_TIME_KEY = "reminder_time";
export const REMINDER_SOCIAL_KEY = "reminder_social";

const TIMES = ["08:00", "12:30", "18:00", "21:00"];

export default function NotifyScreen() {
  const insets = useSafeAreaInsets();
  const [time, setTime] = useState("18:00");
  const [social, setSocial] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void SecureStore.getItemAsync(REMINDER_TIME_KEY).then((t) => t && setTime(t));
    void SecureStore.getItemAsync(REMINDER_SOCIAL_KEY).then((v) => v && setSocial(v === "1"));
  }, []);

  async function save() {
    await SecureStore.setItemAsync(REMINDER_TIME_KEY, time);
    await SecureStore.setItemAsync(REMINDER_SOCIAL_KEY, social ? "1" : "0");
    haptic.right();
    setSaved(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Reminders" onBack={() => router.back()} close />
      <View style={{ flex: 1, paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.xl }}>
        <View style={{ alignItems: "center", gap: space.m }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: color.lime, alignItems: "center", justifyContent: "center" }}>
            <Bell size={28} weight="bold" color={color.lime} />
          </View>
          <Txt v="h1Game" center>
            Want a nudge tomorrow?
          </Txt>
          <Txt c={color.muted} center>
            {"One reminder a day when new games go live, and only if you haven't played yet."}
          </Txt>
        </View>

        <View style={{ gap: space.m }}>
          <Eyebrow>Remind me at</Eyebrow>
          <View style={{ flexDirection: "row", gap: space.s }}>
            {TIMES.map((t) => {
              const on = t === time;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    haptic.tap();
                    setTime(t);
                  }}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: radius.tile,
                    borderWidth: 1.5,
                    borderColor: on ? color.lime : color.line,
                    backgroundColor: on ? color.lime : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt v="body" c={on ? color.ink : color.cream} style={{ fontFamily: font.mono }}>
                    {t}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <Sword size={20} weight="bold" color={color.cream} />
          <View style={{ flex: 1, gap: space.xs }}>
            <Txt v="rowTitle">Duels and room invites</Txt>
            <Txt v="caption" c={color.muted}>
              When a friend challenges you
            </Txt>
          </View>
          <Switch value={social} onValueChange={setSocial} trackColor={{ true: color.lime, false: color.line }} thumbColor={color.cream} />
        </Card>

        <View style={{ flex: 1 }} />
        <View style={{ gap: space.m, paddingBottom: insets.bottom + space.xxl }}>
          {saved ? (
            <View style={{ flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center" }}>
              <CheckCircle size={20} weight="fill" color={color.right} />
              <Txt v="caption" c={color.cream}>{`Saved for ${time}. Reminders start with the next app update.`}</Txt>
            </View>
          ) : null}
          <Button label={saved ? "Done" : "Turn on reminders"} icon={saved ? undefined : Bell} onPress={saved ? () => router.back() : () => void save()} />
          {!saved ? <Button variant="ghost" label="Not now" onPress={() => router.back()} /> : null}
        </View>
      </View>
    </View>
  );
}
