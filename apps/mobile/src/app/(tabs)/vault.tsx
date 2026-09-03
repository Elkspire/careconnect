import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import {
  deleteVaultRecord,
  getVaultRecordSignedUrl,
  listVaultRecords,
  uploadVaultRecord,
  type VaultRecord,
} from "@/lib/api/vault";
import { getMyMedicalSummary, type MedicalSummary } from "@/lib/api/medical-summary";
import { listMyClinicalHistory, type MyClinicalHistoryEntry } from "@/lib/api/clinical";
import { createShare, listMyShares, revokeShare, type RecordShare } from "@/lib/api/shares";
import { formatClinicDate } from "@/lib/format-time";
import { useAuth } from "@/lib/auth-context";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Screen, LoadingState } from "@/components/ui/screen";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { Colors, Spacing } from "@/constants/theme";

const RECORD_TYPE_LABEL: Record<string, string> = {
  prescription_photo: "Prescription",
  lab_report: "Lab report",
  other_document: "Other document",
};

export default function VaultScreen() {
  const { session } = useAuth();
  const [summary, setSummary] = useState<MedicalSummary | null | undefined>(undefined);
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [history, setHistory] = useState<MyClinicalHistoryEntry[]>([]);
  const [shares, setShares] = useState<RecordShare[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    getMyMedicalSummary().then(setSummary);
    listVaultRecords().then(setRecords);
    listMyClinicalHistory().then(setHistory);
    listMyShares().then(setShares);
  }, [session]);

  useFocusEffect(load);

  if (!session) {
    return <SignInPrompt message="Sign in to see your medical records." />;
  }
  if (summary === undefined) {
    return <LoadingState />;
  }

  async function pickAndUpload() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `upload-${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("recordType", "other_document");
    formData.append("subjectType", "self");
    // RN's FormData wants { uri, name, type } for a file field, not a web File/Blob.
    formData.append("file", {
      uri: asset.uri,
      name: fileName,
      type: asset.mimeType ?? "image/jpeg",
    } as unknown as Blob);

    setUploading(true);
    try {
      await uploadVaultRecord(formData);
      load();
    } catch {
      Alert.alert("Upload failed", "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function viewRecord(id: string) {
    const { url } = await getVaultRecordSignedUrl(id);
    Linking.openURL(url);
  }

  async function removeRecord(id: string) {
    await deleteVaultRecord(id);
    load();
  }

  async function shareRecords() {
    setCreatingShare(true);
    try {
      const share = await createShare({
        subjectType: "self",
        includeClinicalHistory: true,
        includeLabReports: true,
        includeOtherRecords: false,
        duration: "7d",
      });
      Alert.alert(
        "Share link created",
        `Valid for 7 days. Token: ${share.token}\n\nOpen this on the web app at /s/${share.token} to share it — a full native share sheet is a follow-up.`,
      );
      load();
    } catch {
      Alert.alert("Couldn't create a share link", "Please try again.");
    } finally {
      setCreatingShare(false);
    }
  }

  async function revoke(id: string) {
    await revokeShare(id);
    load();
  }

  const hasFlags = summary && (summary.bloodGroup || summary.allergies.length > 0);

  return (
    <Screen>
      <ThemedText type="title">My records</ThemedText>

      <Card>
        <ThemedText type="small" color="onSurfaceMuted" style={styles.uppercase}>
          Medical summary
        </ThemedText>
        {hasFlags ? (
          <View style={styles.flagRow}>
            {summary!.allergies.map((a) => (
              <Flag key={a} label={a} />
            ))}
            {summary!.bloodGroup && <Flag label={summary!.bloodGroup} accent />}
          </View>
        ) : (
          <ThemedText color="onSurfaceMuted">No allergies or blood group on file yet.</ThemedText>
        )}
      </Card>

      <ThemedText type="subtitle" style={styles.sectionHeading}>
        Records
      </ThemedText>
      {records.length === 0 ? (
        <ThemedText color="onBackgroundMuted">No records uploaded yet.</ThemedText>
      ) : (
        records.map((r) => (
          <Card key={r.id} style={styles.card}>
            <ThemedText type="smallBold" color="onSurface">
              {r.fileName}
            </ThemedText>
            <ThemedText type="small" color="onSurfaceMuted">
              {RECORD_TYPE_LABEL[r.recordType] ?? r.recordType}
            </ThemedText>
            <View style={styles.rowGap}>
              <Button label="View" variant="ghost" onPress={() => viewRecord(r.id)} />
              <Button label="Delete" variant="danger" onPress={() => removeRecord(r.id)} />
            </View>
          </Card>
        ))
      )}
      <Button
        label="Upload from photos"
        onPress={pickAndUpload}
        loading={uploading}
        style={{ marginTop: Spacing.two }}
      />

      {history.length > 0 && (
        <>
          <ThemedText type="subtitle" style={styles.sectionHeading}>
            Visit history
          </ThemedText>
          {history.map((entry) => (
            <Card key={entry.appointmentId} style={styles.card}>
              <ThemedText type="small" color="onSurfaceMuted">
                {formatClinicDate(entry.scheduledStart)}
              </ThemedText>
              <ThemedText type="smallBold" color="onSurface">
                {entry.practitionerFullName}
                {entry.diagnosis ? ` — ${entry.diagnosis}` : ""}
              </ThemedText>
              <ThemedText type="small" color="onSurfaceMuted">
                {entry.clinicName}
              </ThemedText>
              <ThemedText color="onSurface" style={{ marginTop: Spacing.one }}>
                {entry.notes}
              </ThemedText>
            </Card>
          ))}
        </>
      )}

      <ThemedText type="subtitle" style={styles.sectionHeading}>
        Share for a second opinion
      </ThemedText>
      {shares.filter((s) => !s.revokedAt).map((s) => (
        <Card key={s.id} style={styles.card}>
          <ThemedText type="small" color="onSurfaceMuted">
            {s.familyMemberFullName ?? "Myself"} · opened {s.accessCount} time
            {s.accessCount === 1 ? "" : "s"}
          </ThemedText>
          <Button
            label="Revoke"
            variant="danger"
            onPress={() => revoke(s.id)}
            style={{ marginTop: Spacing.two }}
          />
        </Card>
      ))}
      <Button
        label="Create a share link"
        variant="ghost"
        onPress={shareRecords}
        loading={creatingShare}
        style={{ marginTop: Spacing.two }}
      />
    </Screen>
  );
}

function Flag({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View style={[styles.flag, accent && styles.flagAccent]}>
      <ThemedText type="small" color={accent ? "surface" : "onSurface"}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  uppercase: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeading: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  card: {
    marginBottom: Spacing.two,
  },
  rowGap: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  flagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  flag: {
    borderWidth: 1,
    borderColor: Colors.seal,
    borderRadius: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  flagAccent: {
    backgroundColor: Colors.seal,
  },
});
