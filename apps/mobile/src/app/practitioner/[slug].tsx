import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getPractitionerProfile, type PractitionerProfile } from "@/lib/api/directory";
import { getPractitionerReviews, submitReview, type PractitionerReviews } from "@/lib/api/reviews";
import { useAuth } from "@/lib/auth-context";
import { ThemedText } from "@/components/themed-text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Chip, ChipRow } from "@/components/ui/chip";
import { LoadingState, ErrorState } from "@/components/ui/screen";
import { Colors, Spacing } from "@/constants/theme";

export default function PractitionerProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<PractitionerProfile | null | undefined>(undefined);
  const [reviews, setReviews] = useState<PractitionerReviews | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPractitionerProfile(slug).then(setProfile);
  }, [slug]);

  const loadReviews = useCallback((practitionerId: string) => {
    getPractitionerReviews(practitionerId).then(setReviews);
  }, []);

  useEffect(() => {
    if (profile) {
      loadReviews(profile.id);
    }
  }, [profile, loadReviews]);

  async function submit() {
    if (!profile) return;
    setSubmitting(true);
    try {
      await submitReview(profile.id, { rating, comment: comment.trim() || undefined });
      setComment("");
      loadReviews(profile.id);
      Alert.alert("Thanks!", "Your review has been submitted.");
    } catch {
      Alert.alert(
        "Couldn't submit review",
        "You can only review a practitioner after a completed visit.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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

      <ThemedText type="subtitle" style={styles.sectionHeading}>
        Leave a review
      </ThemedText>
      <Card>
        {session ? (
          <>
            <ThemedText type="small" color="onSurfaceMuted" style={styles.uppercase}>
              Rating
            </ThemedText>
            <ChipRow>
              {[1, 2, 3, 4, 5].map((value) => (
                <Chip
                  key={value}
                  label={"★".repeat(value)}
                  selected={rating === value}
                  onPress={() => setRating(value)}
                />
              ))}
            </ChipRow>
            <TextField
              label="Comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              style={{ marginTop: Spacing.three, minHeight: 80, textAlignVertical: "top" }}
            />
            <Button
              label="Submit review"
              onPress={submit}
              loading={submitting}
              style={{ marginTop: Spacing.three, alignSelf: "flex-start" }}
            />
            <ThemedText type="small" color="onSurfaceMuted" style={{ marginTop: Spacing.two }}>
              You can only review a practitioner after a completed visit.
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText color="onSurfaceMuted">Sign in to leave a review.</ThemedText>
            <Button
              label="Sign in"
              variant="ghost"
              onPress={() => router.push("/login")}
              style={{ marginTop: Spacing.three, alignSelf: "flex-start" }}
            />
          </>
        )}
      </Card>
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
