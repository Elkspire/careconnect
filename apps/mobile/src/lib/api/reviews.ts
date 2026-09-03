import type { ReportReviewInput, SubmitReviewInput } from "@careconnect/validation";
import { API_URL, authedFetch, parseJsonOrThrow } from "./client";

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface PractitionerReviews {
  summary: ReviewSummary;
  reviews: Review[];
}

// Public — signed-out visitors see ratings too.
export async function getPractitionerReviews(
  practitionerId: string,
): Promise<PractitionerReviews> {
  const res = await fetch(`${API_URL}/practitioners/${practitionerId}/reviews`);
  return parseJsonOrThrow(res, "Get practitioner reviews");
}

export async function submitReview(
  practitionerId: string,
  input: SubmitReviewInput,
): Promise<Review> {
  const res = await authedFetch(`/practitioners/${practitionerId}/reviews`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow(res, "Submit review");
}

/** The :practitionerId in the URL is a formality — the API always acts as the caller's own practitioner id, ignoring it. */
export async function reportReview(
  practitionerId: string,
  reviewId: string,
  input: ReportReviewInput,
): Promise<void> {
  const res = await authedFetch(`/practitioners/${practitionerId}/reviews/${reviewId}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Report review failed: ${res.status}`);
  }
}
