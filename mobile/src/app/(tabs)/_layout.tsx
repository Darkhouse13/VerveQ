import { Tabs } from "expo-router";

import { TabBar } from "@/components/TabBar";
import { color } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.ink } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="weekend" />
      <Tabs.Screen name="ranks" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
