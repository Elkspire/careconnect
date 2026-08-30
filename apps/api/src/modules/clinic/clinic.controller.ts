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
import {
  RequireClinicRole,
  RequireStaffPermission,
} from '../../common/decorators/require-clinic-role.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import {
  CheckInAppointmentDto,
  CreateClinicDto,
  CreatePractitionerLeaveDto,
  InviteStaffDto,
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
    @Body() body: InviteStaffDto,
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
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewPatientList')
  listPatients(@Param('clinicId') clinicId: string) {
    return this.clinicService.listPatients(clinicId);
  }

  @Get(':clinicId/patients/:patientId')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewPatientList')
  getPatientDetail(
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.clinicService.getPatientDetail(clinicId, patientId);
  }

  @Get(':clinicId/patients/:patientId/family/:familyMemberId')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewPatientList')
  getFamilyMemberDetail(
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.clinicService.getFamilyMemberDetail(
      clinicId,
      patientId,
      familyMemberId,
    );
  }

  /**
   * Vault records the patient linked to a visit here — prescriptions/lab
   * reports reveal medical info, so this excludes receptionist, same as
   * clinical notes. Owner and junior_doctor both get full clinical
   * visibility on this clinic's patients.
   */
  @Get(':clinicId/patients/:patientId/records')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getPatientRecords(
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.clinicService.getPatientRecords(clinicId, patientId);
  }

  @Get(':clinicId/patients/:patientId/family/:familyMemberId/records')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getFamilyMemberRecords(
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.clinicService.getFamilyMemberRecords(
      clinicId,
      patientId,
      familyMemberId,
    );
  }

  @Get(':clinicId/records/:recordId/signed-url')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getRecordSignedUrl(
    @Param('clinicId') clinicId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.clinicService.getRecordSignedUrl(clinicId, recordId);
  }

  /** Default landing screen for the clinic dashboard. */
  @Get(':clinicId/today')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewTodayQueue')
  listToday(@Param('clinicId') clinicId: string) {
    return this.clinicService.listToday(clinicId);
  }

  @Post(':clinicId/check-in')
  @RequireClinicRole('owner', 'receptionist')
  @RequireStaffPermission('checkInPatients')
  checkIn(
    @Param('clinicId') clinicId: string,
    @Body() body: CheckInAppointmentDto,
  ) {
    return this.clinicService.checkIn(clinicId, body);
  }
}
