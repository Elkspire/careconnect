import type { SubmitReviewInput } from "@careconnect/validation";
import { authedFetch, parseJsonOrThrow } from "./authedFetch";
import { API_URL } from "./config";

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
export async function getPractitionerReviews(practitionerId: string): Promise<PractitionerReviews> {
  const res = await fetch(`${API_URL}/practitioners/${practitionerId}/reviews`, {
    cache: "no-store",
  });
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
