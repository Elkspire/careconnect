import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Colors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

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
