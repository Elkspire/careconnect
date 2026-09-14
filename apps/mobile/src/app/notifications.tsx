import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";

import { listMyNotifications, type NotificationLogEntry } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth-context";
import { formatClinicDateTime } from "@/lib/format-time";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Screen, LoadingState } from "@/components/ui/screen";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Spacing } from "@/constants/theme";

export default function NotificationsScreen() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<NotificationLogEntry[] | null>(null);

  const load = useCallback(() => {
    if (!session) return;
    listMyNotifications().then(setNotifications);
  }, [session]);

  useFocusEffect(load);

  if (!session) {
    return <SignInPrompt message="Sign in to see your notifications." />;
  }
  if (notifications === null) {
    return <LoadingState />;
  }

  return (
    <Screen>
      <ThemedText type="title">Notifications</ThemedText>
      {notifications.length === 0 ? (
        <ThemedText color="onBackgroundMuted" style={{ marginTop: Spacing.three }}>
          Nothing here yet.
        </ThemedText>
      ) : (
        notifications.map((n) => (
          <Card key={n.id} style={styles.row}>
            <ThemedText type="smallBold" color="onSurface" style={styles.uppercase}>
              {n.eventType.replaceAll("_", " ")}
            </ThemedText>
            <ThemedText type="small" color="onSurfaceMuted">
              {formatClinicDateTime(n.createdAt)}
            </ThemedText>
            {n.message && (
              <ThemedText color="onSurface" style={{ marginTop: Spacing.one }}>
                {n.message}
              </ThemedText>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: Spacing.three,
  },
  uppercase: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
