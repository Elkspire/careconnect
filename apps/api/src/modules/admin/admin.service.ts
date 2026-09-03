import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  authUsers,
  practitionerReviews,
  practitioners,
  reviewReports,
} from '../../common/database/schema';

/**
 * Practitioner verification review — the product doc's own first "open
 * question," previously unresolved (verification_status gated directory
 * visibility but nothing let anyone actually flip it). Reviews what the
 * platform actually captures today: name, registration number,
 * practitioner type. No document upload/review — that's a real, separate
 * gap, not solved here (see 0014_admin_verification.sql).
 */
@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  listPractitioners(status?: 'unverified' | 'pending' | 'verified') {
    return this.db
      .select({
        id: practitioners.id,
        fullName: practitioners.fullName,
        practitionerType: practitioners.practitionerType,
        councilRegistrationNo: practitioners.councilRegistrationNo,
        verificationStatus: practitioners.verificationStatus,
        verificationNote: practitioners.verificationNote,
        verifiedAt: practitioners.verifiedAt,
        phone: authUsers.phone,
        createdAt: practitioners.createdAt,
      })
      .from(practitioners)
      .innerJoin(authUsers, eq(authUsers.id, practitioners.id))
      .where(
        status
          ? eq(practitioners.verificationStatus, status)
          : inArray(practitioners.verificationStatus, [
              'unverified',
              'pending',
            ]),
      )
      .orderBy(desc(practitioners.createdAt));
  }

  async verify(practitionerId: string) {
    const [row] = await this.db
      .update(practitioners)
      .set({
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verificationNote: null,
      })
      .where(eq(practitioners.id, practitionerId))
      .returning();
    if (!row) {
      throw new NotFoundException('Practitioner not found');
    }
    return row;
  }

  async reject(practitionerId: string, reason: string) {
    const [row] = await this.db
      .update(practitioners)
      .set({
        verificationStatus: 'unverified',
        verifiedAt: null,
        verificationNote: reason,
      })
      .where(
        and(
          eq(practitioners.id, practitionerId),
          // A previously-verified practitioner needs a deliberate,
          // separate revocation path — reject is for reviewing a pending
          // submission, not silently un-verifying someone already live
          // in the directory.
          inArray(practitioners.verificationStatus, ['unverified', 'pending']),
        ),
      )
      .returning();
    if (!row) {
      throw new NotFoundException(
        'Practitioner not found, or already verified — use a separate revoke action for that',
      );
    }
    return row;
  }

  /**
   * Every open (unresolved) report, newest first — a review with multiple
   * reports appears once per report, so a repeatedly-flagged review sorts
   * to the top and an admin sees every reason it was reported. "Open" is
   * simply "the review isn't hidden yet"; once hidden, its reports drop
   * out of this queue since there's nothing left to action.
   */
  listReportedReviews() {
    return this.db
      .select({
        reportId: reviewReports.id,
        reviewId: practitionerReviews.id,
        reason: reviewReports.reason,
        reportedAt: reviewReports.createdAt,
        rating: practitionerReviews.rating,
        comment: practitionerReviews.comment,
        practitionerId: practitionerReviews.practitionerId,
        practitionerFullName: practitioners.fullName,
      })
      .from(reviewReports)
      .innerJoin(
        practitionerReviews,
        eq(practitionerReviews.id, reviewReports.reviewId),
      )
      .innerJoin(
        practitioners,
        eq(practitioners.id, practitionerReviews.practitionerId),
      )
      .where(eq(practitionerReviews.hidden, false))
      .orderBy(desc(reviewReports.createdAt));
  }

  /** Hiding is never a delete (see 0019_review_moderation.sql) — this is the undo list. */
  listHiddenReviews() {
    return this.db
      .select({
        id: practitionerReviews.id,
        rating: practitionerReviews.rating,
        comment: practitionerReviews.comment,
        practitionerId: practitionerReviews.practitionerId,
        practitionerFullName: practitioners.fullName,
      })
      .from(practitionerReviews)
      .innerJoin(
        practitioners,
        eq(practitioners.id, practitionerReviews.practitionerId),
      )
      .where(eq(practitionerReviews.hidden, true))
      .orderBy(desc(practitionerReviews.updatedAt));
  }

  async hideReview(reviewId: string) {
    const [row] = await this.db
      .update(practitionerReviews)
      .set({ hidden: true })
      .where(eq(practitionerReviews.id, reviewId))
      .returning();
    if (!row) {
      throw new NotFoundException('Review not found');
    }
    return row;
  }

  async unhideReview(reviewId: string) {
    const [row] = await this.db
      .update(practitionerReviews)
      .set({ hidden: false })
      .where(eq(practitionerReviews.id, reviewId))
      .returning();
    if (!row) {
      throw new NotFoundException('Review not found');
    }
    return row;
  }
}
