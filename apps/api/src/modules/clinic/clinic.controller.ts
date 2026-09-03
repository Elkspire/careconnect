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
  AssignPatientDto,
  CheckInAppointmentDto,
  CreateClinicDto,
  CreatePractitionerLeaveDto,
  InviteStaffDto,
  RecordVitalsDto,
  UpsertMedicalSummaryDto,
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
  listPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
  ) {
    return this.clinicService.listPatients(clinicId, user.id);
  }

  @Get(':clinicId/patients/:patientId')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewPatientList')
  getPatientDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.clinicService.getPatientDetail(clinicId, user.id, patientId);
  }

  @Get(':clinicId/patients/:patientId/family/:familyMemberId')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewPatientList')
  getFamilyMemberDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.clinicService.getFamilyMemberDetail(
      clinicId,
      user.id,
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.clinicService.getPatientRecords(clinicId, user.id, patientId);
  }

  @Get(':clinicId/patients/:patientId/family/:familyMemberId/records')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getFamilyMemberRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.clinicService.getFamilyMemberRecords(
      clinicId,
      user.id,
      patientId,
      familyMemberId,
    );
  }

  @Get(':clinicId/records/:recordId/signed-url')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getRecordSignedUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('recordId') recordId: string,
  ) {
    return this.clinicService.getRecordSignedUrl(clinicId, user.id, recordId);
  }

  @Get(':clinicId/patients/:patientId/medical-summary')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getPatientMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.clinicService.getPatientMedicalSummary(
      clinicId,
      user.id,
      patientId,
    );
  }

  @Put(':clinicId/patients/:patientId/medical-summary')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('clinicalNotes')
  upsertPatientMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Body() body: UpsertMedicalSummaryDto,
  ) {
    return this.clinicService.upsertPatientMedicalSummary(
      clinicId,
      patientId,
      user.id,
      body,
    );
  }

  @Get(':clinicId/patients/:patientId/family/:familyMemberId/medical-summary')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('viewRecords')
  getFamilyMemberMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.clinicService.getFamilyMemberMedicalSummary(
      clinicId,
      user.id,
      patientId,
      familyMemberId,
    );
  }

  @Put(':clinicId/patients/:patientId/family/:familyMemberId/medical-summary')
  @RequireClinicRole('owner', 'junior_doctor')
  @RequireStaffPermission('clinicalNotes')
  upsertFamilyMemberMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
    @Body() body: UpsertMedicalSummaryDto,
  ) {
    return this.clinicService.upsertFamilyMemberMedicalSummary(
      clinicId,
      patientId,
      familyMemberId,
      user.id,
      body,
    );
  }

  /**
   * Owner-only, deliberately no @RequireStaffPermission ceiling to narrow
   * it by — visit counts and estimated revenue are practice-level
   * business data, not something any staff permission grants a
   * receptionist/junior_doctor/assistant access to.
   */
  @Get(':clinicId/analytics')
  @RequireClinicRole('owner')
  getAnalytics(@Param('clinicId') clinicId: string) {
    return this.clinicService.getAnalytics(clinicId);
  }

  /** Default landing screen for the clinic dashboard. */
  @Get(':clinicId/today')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor', 'assistant')
  @RequireStaffPermission('viewTodayQueue')
  listToday(@Param('clinicId') clinicId: string) {
    return this.clinicService.listToday(clinicId);
  }

  @Get(':clinicId/waitlist')
  @RequireClinicRole('owner', 'receptionist', 'junior_doctor')
  @RequireStaffPermission('viewTodayQueue')
  listWaitlist(@Param('clinicId') clinicId: string) {
    return this.clinicService.listClinicWaitlist(clinicId);
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

  /**
   * "A junior doctor sees the patients assigned to them, not the whole
   * practice" — owner-only, same trust level as staff invite/revoke above.
   */
  @Get(':clinicId/patient-assignments')
  @RequireClinicRole('owner')
  listPatientAssignments(@Param('clinicId') clinicId: string) {
    return this.clinicService.listPatientAssignments(clinicId);
  }

  @Post(':clinicId/patient-assignments')
  @RequireClinicRole('owner')
  assignPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Body() body: AssignPatientDto,
  ) {
    return this.clinicService.assignPatient(
      clinicId,
      user.id,
      body.juniorDoctorUserId,
      body.patientId,
      body.familyMemberId,
    );
  }

  @Delete(':clinicId/patient-assignments/:assignmentId')
  @RequireClinicRole('owner')
  unassignPatient(
    @Param('clinicId') clinicId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.clinicService.unassignPatient(clinicId, assignmentId);
  }

  /**
   * "Not part of your role: prescription pad" — the write side is
   * owner/assistant only, structurally excluding junior_doctor the same
   * way receptionist is excluded from clinical-notes routes.
   */
  @Put(':clinicId/appointments/:appointmentId/vitals')
  @RequireClinicRole('owner', 'assistant')
  @RequireStaffPermission('recordVitals')
  recordVitals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
    @Body() body: RecordVitalsDto,
  ) {
    return this.clinicService.recordVitals(
      clinicId,
      appointmentId,
      user.id,
      body,
    );
  }

  @Get(':clinicId/appointments/:appointmentId/vitals')
  @RequireClinicRole('owner', 'junior_doctor', 'assistant')
  @RequireStaffPermission('recordVitals')
  getVitals(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clinicId') clinicId: string,
    @Param('appointmentId') appointmentId: string,
  ) {
    return this.clinicService.getVitals(clinicId, user.id, appointmentId);
  }
}
