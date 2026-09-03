import { router } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Spacing } from "@/constants/theme";

/** Every auth-gated tab shows this instead of its real content when signed out — same inline-prompt pattern as apps/web's per-page checks, not a hard router redirect. */
export function SignInPrompt({ message }: { message: string }) {
  return (
    <Screen scroll={false}>
      <ThemedText color="onBackgroundMuted" style={{ textAlign: "center" }}>
        {message}
      </ThemedText>
      <Button label="Sign in" onPress={() => router.push("/login")} style={{ marginTop: Spacing.three }} />
    </Screen>
  );
}
