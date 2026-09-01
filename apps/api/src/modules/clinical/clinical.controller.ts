import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireClinicRole,
  RequireStaffPermission,
} from '../../common/decorators/require-clinic-role.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateClinicalNoteDto,
  SavePrescriptionDto,
  UpdateClinicalNoteDto,
} from './clinical.dto';
import { ClinicalService } from './clinical.service';

/**
 * Every route here requires 'owner' or 'junior_doctor' — there is no
 * route+role combination that lets a receptionist pass. A junior doctor
 * co-authors notes under the clinic's own practitioner (see
 * ClinicalService's clinic-membership fallback); the RLS policy on
 * clinical_notes still only trusts `practitioner_id = auth.uid()`, since
 * RLS doesn't run for API-mediated traffic anyway — this API-side check is
 * the real enforcement.
 */
@Controller('clinics/:clinicId/clinical-notes')
@RequireClinicRole('owner', 'junior_doctor')
@RequireStaffPermission('clinicalNotes')
@UseInterceptors(AuditLogInterceptor)
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  @Post()
  @Audit('create', 'clinical_note', 'owner')
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Body() body: CreateClinicalNoteDto,
  ) {
    return this.clinicalService.createNote(user.id, clinicId, body);
  }

  @Get(':appointmentId')
  @Audit('view', 'clinical_note', 'owner')
  getNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.clinicalService.getNote(user.id, clinicId, appointmentId);
  }

  @Patch(':appointmentId')
  @Audit('update', 'clinical_note', 'owner')
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: UpdateClinicalNoteDto,
  ) {
    return this.clinicalService.updateNote(
      user.id,
      clinicId,
      appointmentId,
      body,
    );
  }

  @Get(':appointmentId/allergies')
  @Audit('view', 'clinical_note', 'owner')
  getAppointmentAllergies(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.clinicalService.getAppointmentAllergies(
      user.id,
      clinicId,
      appointmentId,
    );
  }

  @Get(':appointmentId/prescription')
  @Audit('view', 'clinical_note', 'owner')
  getPrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.clinicalService.getPrescription(
      user.id,
      clinicId,
      appointmentId,
    );
  }

  @Post(':appointmentId/prescription')
  @Audit('update', 'clinical_note', 'owner')
  savePrescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: SavePrescriptionDto,
  ) {
    return this.clinicalService.savePrescription(
      user.id,
      clinicId,
      appointmentId,
      body,
    );
  }
}
