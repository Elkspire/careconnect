import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { searchPractitioners, type DirectoryListing } from "@/lib/api/directory";
import { ThemedText } from "@/components/themed-text";
import { TextField } from "@/components/ui/text-field";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/screen";
import { Colors, Spacing } from "@/constants/theme";

const DEFAULT_CITY = "Lahore";

/**
 * The public directory — no session required to browse, matching
 * apps/web's (public) route group. Booking is what actually needs a
 * session; that gate lives on the booking screen, not here.
 */
export default function DirectoryScreen() {
  const [city, setCity] = useState(DEFAULT_CITY);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The mount effect below inlines its own fetch (react-hooks/set-state-in-effect
  // flags an effect that merely *calls* a function containing setState,
  // even past an await) rather than delegating to `search` — which stays
  // the one reusable entry point for the search button and pull-to-refresh,
  // both event handlers, where a synchronous setLoading(true) is fine.
  async function search() {
    setLoading(true);
    setError(null);
    try {
      const res = await searchPractitioners({ city, q: query || undefined, page: 1, pageSize: 20 });
      setResults(res.results);
    } catch {
      setError("Couldn't load the directory. Pull down to try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await searchPractitioners({ city: DEFAULT_CITY, page: 1, pageSize: 20 });
        setResults(res.results);
      } catch {
        setError("Couldn't load the directory. Pull down to try again.");
      } finally {
        setLoading(false);
      }
    })();
    // Only on mount — subsequent searches are explicit (the search button), not on every keystroke.
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <ThemedText type="title">Find a doctor</ThemedText>
        <View style={styles.searchRow}>
          <TextField label="City" value={city} onChangeText={setCity} style={styles.cityInput} />
          <TextField
            label="Search"
            placeholder="Name or specialty"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            style={styles.queryInput}
          />
        </View>
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <View style={styles.centered}>
          <ThemedText color="onBackgroundMuted">{error}</ThemedText>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.practitionerId + item.clinic.id}
          contentContainerStyle={styles.list}
          onRefresh={search}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.centered}>
              <ThemedText color="onBackgroundMuted">
                No doctors found in {city} yet.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/practitioner/${item.practitionerSlug}`)}>
              <Card style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <ThemedText type="subtitle" color="onSurface">
                    {item.fullName}
                  </ThemedText>
                  {item.verificationStatus === "verified" && (
                    <ThemedText type="small" color="verified">
                      ✓ Verified
                    </ThemedText>
                  )}
                </View>
                <ThemedText color="onSurfaceMuted">
                  {item.specialties.map((s) => s.nameEn).join(", ") || item.practitionerType}
                </ThemedText>
                <ThemedText type="small" color="onSurfaceMuted" style={{ marginTop: Spacing.one }}>
                  {item.clinic.name} · {item.clinic.area}, {item.clinic.city}
                </ThemedText>
                <View style={styles.resultFooter}>
                  <ThemedText type="smallBold" color="onSurface">
                    Rs {item.consultationFee}
                  </ThemedText>
                  {item.reviewCount > 0 && (
                    <ThemedText type="small" color="onSurfaceMuted">
                      ★ {item.averageRating?.toFixed(1)} ({item.reviewCount})
                    </ThemedText>
                  )}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  cityInput: {
    flex: 1,
  },
  queryInput: {
    flex: 2,
  },
  list: {
    padding: Spacing.three,
    paddingTop: 0,
    gap: Spacing.two,
  },
  resultCard: {
    gap: Spacing.half,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.two,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
});
