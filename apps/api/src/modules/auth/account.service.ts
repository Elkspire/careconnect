import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq, gt, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  appointments,
  clinics,
  familyMembers,
  patientRecords,
  patients,
  practitionerReviews,
  practitioners,
  practitionerVerificationDocuments,
  recordShares,
  waitlistEntries,
} from '../../common/database/schema';
import { SUPABASE_STORAGE } from '../../common/storage/storage.module';
import { SUPABASE_ADMIN } from '../../common/supabase/supabase-admin.module';
import {
  AppointmentCancelledEvent,
  EVENT_APPOINTMENT_CANCELLED,
} from '../notifications/events';
import { VaultService } from '../vault/vault.service';

const VERIFICATION_BUCKET = 'practitioner-documents';

/** What the account held, so the confirmation page can say what will go. */
export interface DeletionPreview {
  isPatient: boolean;
  isPractitioner: boolean;
  ownedClinics: Array<{ id: string; name: string }>;
  upcomingAtOwnedClinics: number;
  upcomingAsPatient: number;
}

/**
 * Self-service account deletion — immediate, for every role (product
 * decision). What happens depends on what the account is:
 *
 *  - Patient: the clinic's records about them (appointments, notes,
 *    prescriptions, vitals, medical summary) are KEPT but anonymised — the
 *    patient row becomes "Deleted patient" with deleted_at set and no
 *    personal details. Things that are the patient's own go: their own
 *    uploads (files too), share links, reviews, waitlist spots; upcoming
 *    appointments are cancelled so clinics get the slots back.
 *  - Staff (receptionist / junior doctor): their clinic access goes with
 *    the login; records they wrote stay with the author link cleared.
 *  - Clinic owner: their practitioner profile and clinic(s) are removed
 *    (FK cascades) — patients with upcoming appointments there are
 *    notified *before* the cascade, while the clinic still exists to name.
 *
 * Requires migration 0026 (author columns ON DELETE SET NULL; patients no
 * longer cascade from auth.users).
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    @Inject(SUPABASE_STORAGE) private readonly storage: SupabaseClient,
    private readonly vaultService: VaultService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async preview(userId: string): Promise<DeletionPreview> {
    const now = new Date();
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, userId))
      .limit(1);
    const [practitioner] = await this.db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(eq(practitioners.id, userId))
      .limit(1);
    const ownedClinics = await this.db
      .select({ id: clinics.id, name: clinics.name })
      .from(clinics)
      .where(eq(clinics.ownerPractitionerId, userId));

    const upcoming = eq(appointments.status, 'booked');
    const future = gt(appointments.scheduledStart, now);
    const upcomingAtOwnedClinics = ownedClinics.length
      ? await this.db.$count(
          appointments,
          and(
            inArray(
              appointments.clinicId,
              ownedClinics.map((c) => c.id),
            ),
            upcoming,
            future,
          ),
        )
      : 0;
    const upcomingAsPatient = patient
      ? await this.db.$count(
          appointments,
          and(eq(appointments.patientId, userId), upcoming, future),
        )
      : 0;

    return {
      isPatient: !!patient,
      isPractitioner: !!practitioner,
      ownedClinics,
      upcomingAtOwnedClinics,
      upcomingAsPatient,
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    const now = new Date();

    // 1. Clinic owner: cancel upcoming appointments at their clinics and
    //    notify those patients now — emitAsync waits for the notification
    //    listener, which needs the practitioner and clinic rows that the
    //    final auth delete is about to cascade away.
    const owned = await this.db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.ownerPractitionerId, userId));
    if (owned.length) {
      const cancelled = await this.db
        .update(appointments)
        .set({
          status: 'cancelled',
          cancellationReason: 'Clinic closed: the doctor deleted their account',
          cancelledAt: now,
        })
        .where(
          and(
            inArray(
              appointments.clinicId,
              owned.map((c) => c.id),
            ),
            eq(appointments.status, 'booked'),
            gt(appointments.scheduledStart, now),
          ),
        )
        .returning();
      for (const a of cancelled) {
        await this.eventEmitter.emitAsync(
          EVENT_APPOINTMENT_CANCELLED,
          new AppointmentCancelledEvent(
            {
              appointmentId: a.id,
              patientId: a.patientId,
              practitionerId: a.practitionerId,
              clinicId: a.clinicId,
              scheduledStart: a.scheduledStart,
            },
            true,
          ),
        );
      }
    }

    // 2. Verification documents (CNIC, degree…): the rows cascade with the
    //    practitioner, the stored files don't — remove those explicitly.
    const docs = await this.db
      .select({ filePath: practitionerVerificationDocuments.filePath })
      .from(practitionerVerificationDocuments)
      .where(eq(practitionerVerificationDocuments.practitionerId, userId));
    if (docs.length) {
      await this.storage.storage
        .from(VERIFICATION_BUCKET)
        .remove(docs.map((d) => d.filePath));
    }

    // 3. Patient: remove what's theirs, anonymise what the clinic keeps.
    const [patient] = await this.db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.id, userId))
      .limit(1);
    if (patient) {
      // Their own uploads (file + row). Records a clinic attached stay.
      const ownUploads = await this.db
        .select({ id: patientRecords.id })
        .from(patientRecords)
        .where(
          and(
            eq(patientRecords.patientId, userId),
            eq(patientRecords.uploadedBy, userId),
          ),
        );
      for (const r of ownUploads) {
        await this.vaultService.deleteRecord(userId, r.id);
      }

      await this.db.transaction(async (tx) => {
        await tx
          .update(appointments)
          .set({
            status: 'cancelled',
            cancellationReason: 'Patient deleted their account',
            cancelledAt: now,
          })
          .where(
            and(
              eq(appointments.patientId, userId),
              eq(appointments.status, 'booked'),
              gt(appointments.scheduledStart, now),
            ),
          );
        await tx
          .delete(waitlistEntries)
          .where(eq(waitlistEntries.patientId, userId));
        await tx.delete(recordShares).where(eq(recordShares.patientId, userId));
        await tx
          .delete(practitionerReviews)
          .where(eq(practitionerReviews.patientId, userId));
        await tx
          .update(familyMembers)
          .set({ fullName: 'Deleted family member', dob: null, gender: null })
          .where(eq(familyMembers.patientId, userId));
        await tx
          .update(patients)
          .set({
            fullName: 'Deleted patient',
            gender: null,
            dob: null,
            email: null,
            preferredLanguage: 'en',
            deletedAt: now,
          })
          .where(eq(patients.id, userId));
      });
    }

    // 4. The login itself. Cascades: practitioner profile -> owned clinics
    //    and their appointments, clinic staff memberships, push tokens,
    //    notifications. Author columns elsewhere are set to null.
    const { error } = await this.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      this.logger.error(`deleteUser(${userId}) failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Your data was removed but the login could not be deleted. Please try again.',
      );
    }
  }
}
