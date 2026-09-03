import { useCallback, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import type { FamilyRelationship } from "@careconnect/shared-types";

import { addFamilyMember, listFamilyMembers, type FamilyMember } from "@/lib/api/patients";
import { useAuth } from "@/lib/auth-context";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Screen, LoadingState } from "@/components/ui/screen";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Spacing } from "@/constants/theme";

const RELATIONSHIPS: FamilyRelationship[] = [
  "husband",
  "wife",
  "son",
  "daughter",
  "mother",
  "father",
];

export default function FamilyScreen() {
  const { session } = useAuth();
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState<FamilyRelationship>("son");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    listFamilyMembers().then(setMembers);
  }, [session]);

  useFocusEffect(load);

  if (!session) {
    return <SignInPrompt message="Sign in to manage your family's profiles." />;
  }
  if (members === null) {
    return <LoadingState />;
  }

  async function submit() {
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      await addFamilyMember({ fullName: fullName.trim(), relationship });
      setFullName("");
      setShowForm(false);
      load();
    } catch {
      Alert.alert("Couldn't add family member", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ThemedText type="title">Family</ThemedText>

      {members.length === 0 && !showForm ? (
        <ThemedText color="onBackgroundMuted">
          Add a family member to book and track their records too.
        </ThemedText>
      ) : (
        members.map((m) => (
          <Card key={m.id} style={styles.card}>
            <ThemedText type="smallBold" color="onSurface">
              {m.fullName}
            </ThemedText>
            <ThemedText type="small" color="onSurfaceMuted" style={styles.capitalize}>
              {m.relationship}
            </ThemedText>
          </Card>
        ))
      )}

      {showForm ? (
        <Card style={{ marginTop: Spacing.three, gap: Spacing.three }}>
          <TextField label="Full name" value={fullName} onChangeText={setFullName} />
          <ThemedText type="small" color="onSurfaceMuted" style={styles.uppercase}>
            Relationship
          </ThemedText>
          <ChipRow>
            {RELATIONSHIPS.map((r) => (
              <Chip key={r} label={r} selected={relationship === r} onPress={() => setRelationship(r)} />
            ))}
          </ChipRow>
          <Button label="Add" onPress={submit} loading={submitting} disabled={!fullName.trim()} />
        </Card>
      ) : (
        <Button
          label="Add family member"
          variant="ghost"
          onPress={() => setShowForm(true)}
          style={{ marginTop: Spacing.three }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.two,
  },
  capitalize: {
    textTransform: "capitalize",
  },
  uppercase: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
