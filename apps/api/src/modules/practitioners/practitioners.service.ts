import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { RegisterPractitionerInput } from '@careconnect/validation';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  practitioners,
  practitionerSpecialties,
} from '../../common/database/schema';
import { slugify } from '../../common/util/slug';

@Injectable()
export class PractitionersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * A one-time self-registration, not an upsert — re-submitting would mean
   * silently replacing an already-reviewed (possibly verified) profile and
   * its specialty list, so a second call is rejected outright rather than
   * treated as an edit. verification_status defaults to 'unverified' (see
   * 0001_init.sql) — this practitioner won't appear in the public directory
   * or be bookable until an admin verifies them (see AdminModule).
   */
  async register(userId: string, input: RegisterPractitionerInput) {
    const [existing] = await this.db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(eq(practitioners.id, userId))
      .limit(1);
    if (existing) {
      throw new ConflictException('You already have a practitioner profile');
    }

    const { specialtyIds, ...profile } = input;
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(practitioners)
        .values({ id: userId, slug: slugify(input.fullName), ...profile })
        .returning();
      await tx
        .insert(practitionerSpecialties)
        .values(
          specialtyIds.map((specialtyId) => ({
            practitionerId: userId,
            specialtyId,
          })),
        );
      return row;
    });
  }
}
