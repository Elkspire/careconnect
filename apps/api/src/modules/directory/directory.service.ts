import { Inject, Injectable } from '@nestjs/common';
import type { DirectorySearchQuery } from '@careconnect/validation';
import type { PractitionerType } from '@careconnect/shared-types';
import { and, asc, eq, gte, ilike, inArray, lte, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  clinics,
  practitionerClinic,
  practitionerSpecialties,
  practitioners,
  specialties,
} from '../../common/database/schema';
import { ReviewsService } from '../reviews/reviews.service';

export interface DirectoryListing {
  practitionerId: string;
  practitionerSlug: string;
  fullName: string;
  gender: string | null;
  practitionerType: string;
  verificationStatus: string;
  languages: string[];
  averageRating: number | null;
  reviewCount: number;
  specialties: Array<{ id: string; nameEn: string; nameUr: string | null }>;
  clinic: {
    id: string;
    slug: string;
    name: string;
    city: string;
    area: string;
  };
  consultationFee: string;
  slotLengthMinutes: number;
}

export interface DirectorySearchResult {
  results: DirectoryListing[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PractitionerProfile {
  id: string;
  slug: string;
  fullName: string;
  gender: string | null;
  practitionerType: string;
  verificationStatus: string;
  bio: string | null;
  languages: string[];
  averageRating: number | null;
  reviewCount: number;
  specialties: Array<{ id: string; nameEn: string; nameUr: string | null }>;
  clinics: Array<{
    id: string;
    slug: string;
    name: string;
    city: string;
    area: string;
    address: string;
    phone: string | null;
    consultationFee: string;
    slotLengthMinutes: number;
  }>;
}

@Injectable()
export class DirectoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reviewsService: ReviewsService,
  ) {}

  /** Feeds the practitioner-registration specialty picker (see PractitionersModule) as well as any future directory filter-by-specialty UI. */
  listSpecialties(practitionerType?: PractitionerType) {
    return this.db
      .select({
        id: specialties.id,
        nameEn: specialties.nameEn,
        nameUr: specialties.nameUr,
        practitionerType: specialties.practitionerType,
      })
      .from(specialties)
      .where(
        practitionerType
          ? eq(specialties.practitionerType, practitionerType)
          : undefined,
      )
      .orderBy(asc(specialties.nameEn));
  }

  async search(query: DirectorySearchQuery): Promise<DirectorySearchResult> {
    const conditions = [
      eq(clinics.city, query.city),
      eq(practitionerClinic.isActive, true),
    ];
    if (query.area) conditions.push(eq(clinics.area, query.area));
    if (query.practitionerType)
      conditions.push(
        eq(practitioners.practitionerType, query.practitionerType),
      );
    if (query.gender) conditions.push(eq(practitioners.gender, query.gender));
    if (query.minFee !== undefined)
      conditions.push(
        gte(practitionerClinic.consultationFee, String(query.minFee)),
      );
    if (query.maxFee !== undefined)
      conditions.push(
        lte(practitionerClinic.consultationFee, String(query.maxFee)),
      );
    if (query.q) conditions.push(ilike(practitioners.fullName, `%${query.q}%`));
    if (query.language) {
      conditions.push(sql`${query.language} = any(${practitioners.languages})`);
    }
    if (query.specialtyId) {
      conditions.push(
        inArray(
          practitioners.id,
          this.db
            .select({ id: practitionerSpecialties.practitionerId })
            .from(practitionerSpecialties)
            .where(eq(practitionerSpecialties.specialtyId, query.specialtyId)),
        ),
      );
    }
    // NOTE: query.nextAvailableOnly is not applied yet — real "next available
    // slot" filtering needs the availability computation BookingModule adds
    // in M4 (slots are computed at query time, not stored). Wire it there.

    const where = and(...conditions);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          practitionerId: practitioners.id,
          practitionerSlug: practitioners.slug,
          fullName: practitioners.fullName,
          gender: practitioners.gender,
          practitionerType: practitioners.practitionerType,
          verificationStatus: practitioners.verificationStatus,
          languages: practitioners.languages,
          clinicId: clinics.id,
          clinicSlug: clinics.slug,
          clinicName: clinics.name,
          clinicCity: clinics.city,
          clinicArea: clinics.area,
          consultationFee: practitionerClinic.consultationFee,
          slotLengthMinutes: practitionerClinic.slotLengthMinutes,
        })
        .from(practitionerClinic)
        .innerJoin(
          practitioners,
          eq(practitioners.id, practitionerClinic.practitionerId),
        )
        .innerJoin(clinics, eq(clinics.id, practitionerClinic.clinicId))
        .where(where)
        .orderBy(asc(practitioners.fullName))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(practitionerClinic)
        .innerJoin(
          practitioners,
          eq(practitioners.id, practitionerClinic.practitionerId),
        )
        .innerJoin(clinics, eq(clinics.id, practitionerClinic.clinicId))
        .where(where),
    ]);
    const count = countRows[0]?.count ?? 0;

    const practitionerIds = [...new Set(rows.map((r) => r.practitionerId))];
    const [specialtyRows, reviewSummaries] = await Promise.all([
      practitionerIds.length
        ? this.db
            .select({
              practitionerId: practitionerSpecialties.practitionerId,
              id: specialties.id,
              nameEn: specialties.nameEn,
              nameUr: specialties.nameUr,
            })
            .from(practitionerSpecialties)
            .innerJoin(
              specialties,
              eq(specialties.id, practitionerSpecialties.specialtyId),
            )
            .where(
              inArray(practitionerSpecialties.practitionerId, practitionerIds),
            )
        : [],
      this.reviewsService.getSummariesFor(practitionerIds),
    ]);

    const specialtiesByPractitioner = new Map<
      string,
      DirectoryListing['specialties']
    >();
    for (const row of specialtyRows) {
      const list = specialtiesByPractitioner.get(row.practitionerId) ?? [];
      list.push({ id: row.id, nameEn: row.nameEn, nameUr: row.nameUr });
      specialtiesByPractitioner.set(row.practitionerId, list);
    }

    const results: DirectoryListing[] = rows.map((r) => ({
      practitionerId: r.practitionerId,
      practitionerSlug: r.practitionerSlug,
      fullName: r.fullName,
      gender: r.gender,
      practitionerType: r.practitionerType,
      verificationStatus: r.verificationStatus,
      languages: r.languages,
      averageRating:
        reviewSummaries.get(r.practitionerId)?.averageRating ?? null,
      reviewCount: reviewSummaries.get(r.practitionerId)?.reviewCount ?? 0,
      specialties: specialtiesByPractitioner.get(r.practitionerId) ?? [],
      clinic: {
        id: r.clinicId,
        slug: r.clinicSlug,
        name: r.clinicName,
        city: r.clinicCity,
        area: r.clinicArea,
      },
      consultationFee: r.consultationFee,
      slotLengthMinutes: r.slotLengthMinutes,
    }));

    return {
      results,
      page: query.page,
      pageSize: query.pageSize,
      total: count,
    };
  }

  async findBySlug(slug: string): Promise<PractitionerProfile | null> {
    const [practitioner] = await this.db
      .select({
        id: practitioners.id,
        slug: practitioners.slug,
        fullName: practitioners.fullName,
        gender: practitioners.gender,
        practitionerType: practitioners.practitionerType,
        verificationStatus: practitioners.verificationStatus,
        bio: practitioners.bio,
        languages: practitioners.languages,
      })
      .from(practitioners)
      .where(eq(practitioners.slug, slug))
      .limit(1);

    if (!practitioner) {
      return null;
    }
    const practitionerId = practitioner.id;

    const [specialtyRows, clinicRows, reviewSummary] = await Promise.all([
      this.db
        .select({
          id: specialties.id,
          nameEn: specialties.nameEn,
          nameUr: specialties.nameUr,
        })
        .from(practitionerSpecialties)
        .innerJoin(
          specialties,
          eq(specialties.id, practitionerSpecialties.specialtyId),
        )
        .where(eq(practitionerSpecialties.practitionerId, practitionerId)),
      this.db
        .select({
          id: clinics.id,
          slug: clinics.slug,
          name: clinics.name,
          city: clinics.city,
          area: clinics.area,
          address: clinics.address,
          phone: clinics.phone,
          consultationFee: practitionerClinic.consultationFee,
          slotLengthMinutes: practitionerClinic.slotLengthMinutes,
        })
        .from(practitionerClinic)
        .innerJoin(clinics, eq(clinics.id, practitionerClinic.clinicId))
        .where(
          and(
            eq(practitionerClinic.practitionerId, practitionerId),
            eq(practitionerClinic.isActive, true),
          ),
        ),
      this.reviewsService.getSummary(practitionerId),
    ]);

    return {
      ...practitioner,
      ...reviewSummary,
      specialties: specialtyRows,
      clinics: clinicRows,
    };
  }
}
