import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { registerExpoPushToken } from "@/lib/api/push";
import { getExpoPushToken } from "@/lib/push-notifications";
import { Colors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  // Best-effort: getExpoPushToken() already no-ops (returns null) on a
  // simulator, without permission, or without an EAS project id configured
  // — nothing to register in those cases.
  useEffect(() => {
    if (!session) return;
    getExpoPushToken().then((token) => {
      if (token) {
        registerExpoPushToken(token).catch(() => {});
      }
    });
  }, [session]);

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
      <Stack.Screen name="(tabs)" />
      {/* Signed in already? Bounce straight back — see login.tsx. */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Screen name="practitioner/[slug]" options={{ headerShown: true, title: "" }} />
      <Stack.Screen
        name="book/[practitionerSlug]/[clinicId]"
        options={{ headerShown: true, title: "" }}
      />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
