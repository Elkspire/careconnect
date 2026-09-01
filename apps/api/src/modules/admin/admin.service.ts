import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import { authUsers, practitioners } from '../../common/database/schema';

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
}
