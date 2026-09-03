import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getPractitionerProfile, type PractitionerProfile } from "@/lib/api/directory";
import { listFamilyMembers, type FamilyMember } from "@/lib/api/patients";
import {
  createAppointment,
  getAvailability,
  joinWaitlist,
  type DayAvailability,
} from "@/lib/api/booking";
import { clinicDateIsoPlusDays, clinicTodayIso, formatClinicTime } from "@/lib/format-time";
import { useAuth } from "@/lib/auth-context";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { LoadingState } from "@/components/ui/screen";
import { Colors, Spacing } from "@/constants/theme";

const DATE_QUICK_PICKS = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "+2 days", offset: 2 },
  { label: "+3 days", offset: 3 },
];

export default function BookAppointmentScreen() {
  const { practitionerSlug, clinicId } = useLocalSearchParams<{
    practitionerSlug: string;
    clinicId: string;
  }>();
  const { session } = useAuth();

  const [profile, setProfile] = useState<PractitionerProfile | null | undefined>(undefined);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [subject, setSubject] = useState<{ familyMemberId?: string }>({});
  const [date, setDate] = useState(clinicTodayIso());
  const [day, setDay] = useState<DayAvailability | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Derived, not a separate state var set synchronously in the effect
  // below (react-hooks/set-state-in-effect) — "no day loaded yet, or the
  // one we have is for a different date than what's selected now."
  const loadingSlots = !day || day.date !== date;

  useEffect(() => {
    // A signed-out visitor can preview slots (getAvailability is public),
    // but actually booking needs an account — bounce to login rather than
    // letting the request 401 after they've already picked a slot.
    if (!session) {
      router.replace("/login");
    }
  }, [session]);

  useEffect(() => {
    getPractitionerProfile(practitionerSlug).then(setProfile);
    if (session) {
      listFamilyMembers().then(setFamilyMembers).catch(() => {});
    }
  }, [practitionerSlug, session]);

  useEffect(() => {
    if (!profile) return;
    getAvailability({ practitionerId: profile.id, clinicId, fromDate: date, toDate: date }).then(
      (days) => setDay(days[0] ?? { date, slots: [] }),
    );
  }, [profile, clinicId, date]);

  const clinic = profile?.clinics.find((c) => c.id === clinicId);

  async function book(scheduledStart: string) {
    setSubmitting(true);
    try {
      await createAppointment({
        subjectType: subject.familyMemberId ? "family_member" : "self",
        familyMemberId: subject.familyMemberId,
        practitionerId: profile!.id,
        clinicId,
        scheduledStart,
      });
      Alert.alert("Booked", "Your appointment is confirmed.", [
        { text: "View appointments", onPress: () => router.replace("/(tabs)/appointments") },
      ]);
    } catch {
      Alert.alert("Couldn't book that slot", "Someone may have just taken it — try another.");
    } finally {
      setSubmitting(false);
    }
  }

  async function joinWaitlistForDate() {
    setSubmitting(true);
    try {
      await joinWaitlist({
        subjectType: subject.familyMemberId ? "family_member" : "self",
        familyMemberId: subject.familyMemberId,
        practitionerId: profile!.id,
        clinicId,
        requestedDate: date,
      });
      Alert.alert("Added to waitlist", "We'll notify you if a slot opens up.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/appointments") },
      ]);
    } catch {
      Alert.alert("Couldn't join the waitlist", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session || profile === undefined) {
    return <LoadingState />;
  }
  if (profile === null || !clinic) {
    return <LoadingState />;
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <ThemedText type="title">Book with {profile.fullName}</ThemedText>
      <ThemedText color="onBackgroundMuted">{clinic.name}</ThemedText>

      {familyMembers.length > 0 && (
        <Card style={{ marginTop: Spacing.three }}>
          <ThemedText type="small" color="onSurfaceMuted" style={styles.uppercase}>
            Who is this for?
          </ThemedText>
          <ChipRow>
            <Chip
              label="Myself"
              selected={!subject.familyMemberId}
              onPress={() => setSubject({})}
            />
            {familyMembers.map((m) => (
              <Chip
                key={m.id}
                label={m.fullName}
                selected={subject.familyMemberId === m.id}
                onPress={() => setSubject({ familyMemberId: m.id })}
              />
            ))}
          </ChipRow>
        </Card>
      )}

      <Card style={{ marginTop: Spacing.three }}>
        <ThemedText type="small" color="onSurfaceMuted" style={styles.uppercase}>
          Date
        </ThemedText>
        <ChipRow>
          {DATE_QUICK_PICKS.map((pick) => {
            const iso = clinicDateIsoPlusDays(pick.offset);
            return (
              <Chip
                key={pick.offset}
                label={pick.label}
                selected={date === iso}
                onPress={() => setDate(iso)}
              />
            );
          })}
        </ChipRow>
      </Card>

      <ThemedText type="subtitle" style={{ marginTop: Spacing.four, marginBottom: Spacing.two }}>
        Available times
      </ThemedText>
      {loadingSlots ? (
        <LoadingState />
      ) : day && day.slots.length > 0 ? (
        <View style={styles.slotGrid}>
          {day.slots.map((slot) => (
            <Pressable key={slot.start} disabled={submitting} onPress={() => book(slot.start)}>
              <View style={styles.slot}>
                <ThemedText type="smallBold" color="onSurface">
                  {formatClinicTime(slot.start)}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Card>
          <ThemedText color="onSurfaceMuted">No open slots on this date.</ThemedText>
          <Button
            label="Join the waitlist for this date"
            variant="ghost"
            onPress={joinWaitlistForDate}
            loading={submitting}
            style={{ marginTop: Spacing.three }}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.three,
  },
  uppercase: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  slot: {
    minWidth: 84,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.two,
  },
});
