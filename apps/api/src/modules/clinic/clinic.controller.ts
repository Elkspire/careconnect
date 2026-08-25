import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireClinicRole } from '../../common/decorators/require-clinic-role.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import {
  CheckInAppointmentDto,
  CreateClinicDto,
  CreatePractitionerLeaveDto,
  InviteReceptionistDto,
  UpsertPractitionerClinicDto,
} from './clinic.dto';
import { ClinicService } from './clinic.service';

@Controller('clinics')
export class ClinicController {
  constructor(private readonly clinicService: ClinicService) {}

  @Post()
  createClinic(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateClinicDto,
  ) {
    return this.clinicService.createClinic(user.id, body);
  }

  @Get('mine')
  listMyClinics(@CurrentUser() user: AuthenticatedUser) {
    return this.clinicService.listMyClinics(user.id);
  }

  @Put(':clinicId/practitioner-config')
  @RequireClinicRole('owner')
  upsertPractitionerConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Body() body: UpsertPractitionerClinicDto,
  ) {
    return this.clinicService.upsertPractitionerConfig(user.id, clinicId, body);
  }

  @Post(':clinicId/leave')
  @RequireClinicRole('owner')
  addLeave(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePractitionerLeaveDto,
  ) {
    return this.clinicService.addLeave(user.id, body);
  }

  @Post(':clinicId/staff')
  @RequireClinicRole('owner')
  inviteStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Body() body: InviteReceptionistDto,
  ) {
    return this.clinicService.inviteStaff(clinicId, user.id, body);
  }

  @Get(':clinicId/staff')
  @RequireClinicRole('owner')
  listStaff(@Param('clinicId') clinicId: string) {
    return this.clinicService.listStaff(clinicId);
  }

  @Delete(':clinicId/staff/:staffId')
  @RequireClinicRole('owner')
  revokeStaff(
    @Param('clinicId') clinicId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.clinicService.revokeStaff(clinicId, staffId);
  }

  /** Non-clinical: name, phone, last visit only. See ClinicService.listPatients. */
  @Get(':clinicId/patients')
  @RequireClinicRole('owner', 'receptionist')
  listPatients(@Param('clinicId') clinicId: string) {
    return this.clinicService.listPatients(clinicId);
  }

  /** Default landing screen for the clinic dashboard. */
  @Get(':clinicId/today')
  @RequireClinicRole('owner', 'receptionist')
  listToday(@Param('clinicId') clinicId: string) {
    return this.clinicService.listToday(clinicId);
  }

  @Post(':clinicId/check-in')
  @RequireClinicRole('owner', 'receptionist')
  checkIn(
    @Param('clinicId') clinicId: string,
    @Body() body: CheckInAppointmentDto,
  ) {
    return this.clinicService.checkIn(clinicId, body);
  }
}
