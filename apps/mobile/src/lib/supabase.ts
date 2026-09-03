import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — see apps/mobile/.env.example",
  );
}

// expo-router's web target statically pre-renders every route in Node at
// build/export time — there's no `window` there at all, and
// @react-native-async-storage/async-storage's web shim assumes one exists
// (it wraps localStorage), so using it unconditionally crashes
// `expo export --platform web` with "window is not defined" before a
// single screen ever reaches a real browser. Native (iOS/Android) always
// has a real AsyncStorage; an actual browser gets supabase-js's own
// default (browser localStorage) by passing no `storage` override; only
// the Node prerender pass gets a session-less client.
const isServer = typeof window === "undefined";
const storage = isServer ? undefined : Platform.OS === "web" ? undefined : AsyncStorage;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    // No browser URL to parse a session out of on a native client.
    detectSessionInUrl: false,
  },
});

// Supabase's own recommendation for RN: token auto-refresh only ticks while
// something is actively calling it, so drive it off app foreground/
// background state — otherwise a session silently goes stale while the app
// sits backgrounded and the next foreground open finds it already expired.
// Guarded the same way as above — nothing to refresh during a Node prerender.
if (!isServer) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
