import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { ClinicalService } from './clinical.service';

/**
 * Separate from ClinicalController on purpose: that one is entirely
 * clinic-staff-scoped (@RequireClinicRole class-wide), this one is a
 * patient reading their own history — no clinic role guard at all, just
 * "is this your own auth session." Same ClinicalService, same clinical_notes
 * isolation, a different (and much simpler) authorization shape.
 */
@Controller('patients/me/clinical-history')
export class PatientClinicalController {
  constructor(private readonly clinicalService: ClinicalService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.clinicalService.listMyHistory(user.id);
  }
}
