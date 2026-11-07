import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono";
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts } from "@expo-google-fonts/space-grotesk";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { hasSeenWelcome } from "@/components/account/welcomeFlag";
import { AuthProvider } from "@/lib/auth";
import { color } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ SpaceGrotesk_700Bold, SpaceGrotesk_500Medium, JetBrainsMono_700Bold });
  useEffect(() => {
    if (!loaded) return;
    void SplashScreen.hideAsync();
    // First launch only: show Welcome once, then Play.
    void hasSeenWelcome().then((seen) => {
      if (!seen) router.replace("/welcome");
    });
  }, [loaded]);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.ink }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ink }, animation: "slide_from_right" }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
