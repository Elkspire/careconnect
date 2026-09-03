import { Tabs } from "expo-router";
import { Text } from "react-native";

import { Colors } from "@/constants/theme";

/** Emoji tab icons — no icon font/asset pipeline set up yet; swap for a real icon set once the app has a design pass. */
function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.mint,
        tabBarInactiveTintColor: Colors.onBackgroundMuted,
        tabBarStyle: { backgroundColor: Colors.backgroundAlt, borderTopColor: Colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Find a doctor",
          tabBarIcon: ({ focused }) => <TabIcon symbol="🔎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appointments",
          tabBarIcon: ({ focused }) => <TabIcon symbol="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Family",
          tabBarIcon: ({ focused }) => <TabIcon symbol="👪" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          title: "My records",
          tabBarIcon: ({ focused }) => <TabIcon symbol="🗂️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ focused }) => <TabIcon symbol="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
