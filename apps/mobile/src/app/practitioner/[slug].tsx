import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getPractitionerProfile, type PractitionerProfile } from "@/lib/api/directory";
import { getPractitionerReviews, type PractitionerReviews } from "@/lib/api/reviews";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/screen";
import { Colors, Spacing } from "@/constants/theme";

export default function PractitionerProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [profile, setProfile] = useState<PractitionerProfile | null | undefined>(undefined);
  const [reviews, setReviews] = useState<PractitionerReviews | null>(null);

  useEffect(() => {
    getPractitionerProfile(slug).then(setProfile);
  }, [slug]);

  useEffect(() => {
    if (profile) {
      getPractitionerReviews(profile.id).then(setReviews);
    }
  }, [profile]);

  if (profile === undefined) {
    return <LoadingState />;
  }
  if (profile === null) {
    return <ErrorState message="This practitioner couldn't be found." />;
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Card>
        <ThemedText type="title" color="onSurface">
          {profile.fullName}
        </ThemedText>
        <ThemedText type="small" color="onSurfaceMuted" style={styles.uppercase}>
          {profile.practitionerType}
          {profile.verificationStatus === "verified" ? " · ✓ Verified" : ""}
        </ThemedText>
        {profile.bio && (
          <ThemedText color="onSurface" style={{ marginTop: Spacing.two }}>
            {profile.bio}
          </ThemedText>
        )}
        {profile.specialties.length > 0 && (
          <ThemedText color="onSurfaceMuted" style={{ marginTop: Spacing.two }}>
            {profile.specialties.map((s) => s.nameEn).join(", ")}
          </ThemedText>
        )}
        <View style={styles.ratingRow}>
          {reviews && reviews.summary.reviewCount > 0 ? (
            <ThemedText color="onSurface">
              ★ {reviews.summary.averageRating?.toFixed(1)} ({reviews.summary.reviewCount} reviews)
            </ThemedText>
          ) : (
            <ThemedText color="onSurfaceMuted">No reviews yet</ThemedText>
          )}
        </View>
      </Card>

      <ThemedText type="subtitle" style={styles.sectionHeading}>
        Clinics
      </ThemedText>
      {profile.clinics.map((clinic) => (
        <Card key={clinic.id} style={{ marginBottom: Spacing.two }}>
          <ThemedText type="smallBold" color="onSurface">
            {clinic.name}
          </ThemedText>
          <ThemedText type="small" color="onSurfaceMuted">
            {clinic.address}
          </ThemedText>
          <ThemedText type="small" color="onSurfaceMuted">
            {clinic.area}, {clinic.city}
          </ThemedText>
          <ThemedText type="smallBold" color="onSurface" style={{ marginTop: Spacing.two }}>
            Rs {clinic.consultationFee}
          </ThemedText>
          <Button
            label="Book at this clinic"
            onPress={() => router.push(`/book/${profile.slug}/${clinic.id}`)}
            style={{ marginTop: Spacing.two }}
          />
        </Card>
      ))}

      {reviews && reviews.reviews.length > 0 && (
        <>
          <ThemedText type="subtitle" style={styles.sectionHeading}>
            Reviews
          </ThemedText>
          <Card>
            {reviews.reviews.map((review, i) => (
              <View
                key={review.id}
                style={i > 0 ? [styles.reviewRow, { borderTopWidth: 1, borderTopColor: Colors.border }] : styles.reviewRow}
              >
                <ThemedText color="onSurface">★ {review.rating}</ThemedText>
                {review.comment && (
                  <ThemedText color="onSurfaceMuted" style={{ marginTop: Spacing.half }}>
                    {review.comment}
                  </ThemedText>
                )}
              </View>
            ))}
          </Card>
        </>
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
    marginTop: Spacing.half,
  },
  ratingRow: {
    marginTop: Spacing.two,
  },
  sectionHeading: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  reviewRow: {
    paddingVertical: Spacing.two,
  },
});
