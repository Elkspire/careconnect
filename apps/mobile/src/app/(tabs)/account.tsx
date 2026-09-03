import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";

import { getMyProfile, upsertMyProfile, type PatientProfile } from "@/lib/api/patients";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Screen, LoadingState } from "@/components/ui/screen";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Spacing } from "@/constants/theme";

export default function AccountScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null | undefined>(undefined);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    getMyProfile().then((p) => {
      setProfile(p);
      setFullName(p?.fullName ?? "");
    });
  }, [session]);

  useFocusEffect(load);

  if (!session) {
    return <SignInPrompt message="Sign in to manage your account." />;
  }
  if (profile === undefined) {
    return <LoadingState />;
  }

  async function save() {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      await upsertMyProfile({ fullName: fullName.trim(), preferredLanguage: "en" });
      load();
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <Screen>
      <ThemedText type="title">Account</ThemedText>
      <ThemedText color="onBackgroundMuted">{session.user.phone}</ThemedText>

      <Card style={{ marginTop: Spacing.three, gap: Spacing.three }}>
        {!profile && (
          <ThemedText color="seal">Finish setting up your profile below.</ThemedText>
        )}
        <TextField label="Full name" value={fullName} onChangeText={setFullName} />
        <Button label="Save" onPress={save} loading={saving} disabled={!fullName.trim()} />
      </Card>

      <Button
        label="Sign out"
        variant="ghost"
        onPress={signOut}
        style={{ marginTop: Spacing.four }}
      />
    </Screen>
  );
}
