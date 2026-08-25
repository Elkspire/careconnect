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
import { RequireClinicRole } from '../../common/decorators/require-clinic-role.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { CreateClinicalNoteDto, UpdateClinicalNoteDto } from './clinical.dto';
import { ClinicalService } from './clinical.service';

/**
 * Every route here requires 'owner' — there is no route+role combination
 * that lets a receptionist pass. This must stay in sync with the
 * clinical_notes RLS policy (practitioner_id = auth.uid() only).
 */
@Controller('clinics/:clinicId/clinical-notes')
@RequireClinicRole('owner')
@UseInterceptors(AuditLogInterceptor)
export class ClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  @Post()
  @Audit('create', 'clinical_note', 'owner')
  createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateClinicalNoteDto,
  ) {
    return this.clinicalService.createNote(user.id, body);
  }

  @Get(':appointmentId')
  @Audit('view', 'clinical_note', 'owner')
  getNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.clinicalService.getNote(user.id, appointmentId);
  }

  @Patch(':appointmentId')
  @Audit('update', 'clinical_note', 'owner')
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId') appointmentId: string,
    @Body() body: UpdateClinicalNoteDto,
  ) {
    return this.clinicalService.updateNote(user.id, appointmentId, body);
  }
}
