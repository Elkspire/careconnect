import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ReportReviewInput,
  SubmitReviewInput,
} from '@careconnect/validation';
import { and, avg, count, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  practitionerReviews,
  practitioners,
  reviewReports,
} from '../../common/database/schema';

export interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

/** A patient can only review a practitioner they've actually been seen by. */
const ELIGIBLE_VISIT_STATUSES = ['checked_in', 'completed'] as const;

@Injectable()
export class ReviewsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getSummary(practitionerId: string): Promise<ReviewSummary> {
    const [row] = await this.db
      .select({
        averageRating: avg(practitionerReviews.rating),
        reviewCount: count(practitionerReviews.id),
      })
      .from(practitionerReviews)
      .where(
        and(
          eq(practitionerReviews.practitionerId, practitionerId),
          eq(practitionerReviews.hidden, false),
        ),
      );
    return {
      averageRating: row?.averageRating ? Number(row.averageRating) : null,
      reviewCount: row?.reviewCount ?? 0,
    };
  }

  /** Batch form of getSummary, for the directory search results list. */
  async getSummariesFor(
    practitionerIds: string[],
  ): Promise<Map<string, ReviewSummary>> {
    const map = new Map<string, ReviewSummary>();
    if (practitionerIds.length === 0) {
      return map;
    }
    const rows = await this.db
      .select({
        practitionerId: practitionerReviews.practitionerId,
        averageRating: avg(practitionerReviews.rating),
        reviewCount: count(practitionerReviews.id),
      })
      .from(practitionerReviews)
      .where(
        and(
          inArray(practitionerReviews.practitionerId, practitionerIds),
          eq(practitionerReviews.hidden, false),
        ),
      )
      .groupBy(practitionerReviews.practitionerId);
    for (const row of rows) {
      map.set(row.practitionerId, {
        averageRating: row.averageRating ? Number(row.averageRating) : null,
        reviewCount: row.reviewCount,
      });
    }
    return map;
  }

  list(practitionerId: string) {
    return this.db
      .select({
        id: practitionerReviews.id,
        rating: practitionerReviews.rating,
        comment: practitionerReviews.comment,
        createdAt: practitionerReviews.createdAt,
      })
      .from(practitionerReviews)
      .where(
        and(
          eq(practitionerReviews.practitionerId, practitionerId),
          eq(practitionerReviews.hidden, false),
        ),
      )
      .orderBy(desc(practitionerReviews.createdAt))
      .limit(50);
  }

  /** A practitioner reporting a review of themselves — see reviewReports' own doc comment. */
  async report(
    practitionerId: string,
    reviewId: string,
    input: ReportReviewInput,
  ) {
    const [review] = await this.db
      .select({ id: practitionerReviews.id })
      .from(practitionerReviews)
      .where(
        and(
          eq(practitionerReviews.id, reviewId),
          eq(practitionerReviews.practitionerId, practitionerId),
        ),
      )
      .limit(1);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    const [row] = await this.db
      .insert(reviewReports)
      .values({ reviewId, reportedBy: practitionerId, reason: input.reason })
      .returning();
    return row;
  }

  async submit(
    patientId: string,
    practitionerId: string,
    input: SubmitReviewInput,
  ) {
    const [practitioner] = await this.db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(eq(practitioners.id, practitionerId))
      .limit(1);
    if (!practitioner) {
      throw new NotFoundException('Practitioner not found');
    }

    const [visit] = await this.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          eq(appointments.practitionerId, practitionerId),
          inArray(appointments.status, [...ELIGIBLE_VISIT_STATUSES]),
        ),
      )
      .limit(1);
    if (!visit) {
      throw new ForbiddenException(
        'You can only review a practitioner after visiting them',
      );
    }

    const [row] = await this.db
      .insert(practitionerReviews)
      .values({
        practitionerId,
        patientId,
        rating: input.rating,
        comment: input.comment,
      })
      // One review per patient per practitioner — resubmitting updates it
      // rather than erroring on the unique constraint (0006_practitioner_reviews.sql).
      .onConflictDoUpdate({
        target: [
          practitionerReviews.practitionerId,
          practitionerReviews.patientId,
        ],
        set: {
          rating: input.rating,
          comment: input.comment,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) {
      throw new Error('Insert did not return the review');
    }
    return row;
  }
}
