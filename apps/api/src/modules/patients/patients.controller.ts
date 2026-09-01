import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import {
  AddFamilyMemberDto,
  UpdateFamilyMemberDto,
  UpdatePatientProfileDto,
  UpsertMedicalSummaryDto,
} from './patients.dto';
import { PatientsService } from './patients.service';

@Controller('patients/me')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.getProfile(user.id);
  }

  @Put()
  upsertProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdatePatientProfileDto,
  ) {
    return this.patientsService.upsertProfile(user.id, body);
  }

  @Get('family-members')
  listFamilyMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.listFamilyMembers(user.id);
  }

  @Post('family-members')
  addFamilyMember(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddFamilyMemberDto,
  ) {
    return this.patientsService.addFamilyMember(user.id, body);
  }

  @Patch('family-members/:id')
  updateFamilyMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateFamilyMemberDto,
  ) {
    return this.patientsService.updateFamilyMember(user.id, id, body);
  }

  @Delete('family-members/:id')
  deleteFamilyMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.patientsService.deleteFamilyMember(user.id, id);
  }

  @Get('medical-summary')
  getMedicalSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.getMyMedicalSummary(user.id);
  }

  @Put('medical-summary')
  upsertMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpsertMedicalSummaryDto,
  ) {
    return this.patientsService.upsertMyMedicalSummary(user.id, body);
  }

  @Get('family-members/:id/medical-summary')
  getFamilyMemberMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.patientsService.getFamilyMemberMedicalSummary(user.id, id);
  }

  @Put('family-members/:id/medical-summary')
  upsertFamilyMemberMedicalSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpsertMedicalSummaryDto,
  ) {
    return this.patientsService.upsertFamilyMemberMedicalSummary(
      user.id,
      id,
      body,
    );
  }
}
