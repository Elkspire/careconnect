import { useCallback, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";

import { cancelAppointment, listMyAppointments, type MyAppointment } from "@/lib/api/booking";
import { formatClinicDateTime } from "@/lib/format-time";
import { useAuth } from "@/lib/auth-context";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Screen, LoadingState } from "@/components/ui/screen";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Spacing } from "@/constants/theme";

const STATUS_LABEL: Record<string, string> = {
  booked: "Upcoming",
  checked_in: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

export default function AppointmentsScreen() {
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<MyAppointment[] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!session) return;
    listMyAppointments().then(setAppointments);
  }, [session]);

  // Refetch every time this tab regains focus — an appointment booked
  // from the practitioner/booking screens elsewhere in the stack should
  // show up here without a manual pull-to-refresh.
  useFocusEffect(load);

  if (!session) {
    return <SignInPrompt message="Sign in to see your appointments." />;
  }
  if (appointments === null) {
    return <LoadingState />;
  }

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      await cancelAppointment({ appointmentId: id });
      load();
    } catch {
      Alert.alert("Couldn't cancel", "This may be inside the clinic's cancellation window.");
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming = appointments.filter((a) => a.status === "booked" || a.status === "checked_in");
  const past = appointments.filter((a) => a.status !== "booked" && a.status !== "checked_in");

  return (
    <Screen>
      <ThemedText type="title">Appointments</ThemedText>

      {upcoming.length === 0 ? (
        <ThemedText color="onBackgroundMuted">No upcoming appointments.</ThemedText>
      ) : (
        upcoming.map((appt) => (
          <Card key={appt.id} style={styles.card}>
            <ThemedText type="smallBold" color="onSurface">
              {appt.practitionerFullName}
            </ThemedText>
            <ThemedText color="onSurfaceMuted">{formatClinicDateTime(appt.scheduledStart)}</ThemedText>
            <ThemedText type="small" color="verified" style={{ marginTop: Spacing.one }}>
              {STATUS_LABEL[appt.status] ?? appt.status}
            </ThemedText>
            {appt.status === "booked" && (
              <Button
                label="Cancel"
                variant="danger"
                loading={cancellingId === appt.id}
                onPress={() => cancel(appt.id)}
                style={{ marginTop: Spacing.two }}
              />
            )}
          </Card>
        ))
      )}

      {past.length > 0 && (
        <>
          <ThemedText type="subtitle" style={{ marginTop: Spacing.four }}>
            Past
          </ThemedText>
          {past.map((appt) => (
            <Card key={appt.id} style={styles.card}>
              <ThemedText type="smallBold" color="onSurface">
                {appt.practitionerFullName}
              </ThemedText>
              <ThemedText color="onSurfaceMuted">
                {formatClinicDateTime(appt.scheduledStart)}
              </ThemedText>
              <ThemedText type="small" color="onSurfaceMuted" style={{ marginTop: Spacing.one }}>
                {STATUS_LABEL[appt.status] ?? appt.status}
              </ThemedText>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },
});
