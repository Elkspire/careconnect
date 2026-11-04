import { Controller, Delete, Get, HttpCode, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { CheckRoleEligibilityQueryDto } from './auth.dto';
import { AccountService, type DeletionPreview } from './account.service';
import { AuthService, type LoginRole, type MeResponse } from './auth.service';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountService: AccountService,
  ) {}

  /** Profile-bootstrap: tells the web/mobile client whether this session is a patient, a practitioner, and/or clinic staff, and where to route/onboard them. */
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const profile = await this.authService.getMe(user.id);
    return { id: user.id, phone: user.phone, email: user.email, ...profile };
  }

  /** What deleting this account would remove — drives the confirmation page's wording. */
  @Get('me/deletion-preview')
  getDeletionPreview(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeletionPreview> {
    return this.accountService.preview(user.id);
  }

  /** Permanently deletes the caller's own account (see AccountService). */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.accountService.deleteAccount(user.id);
  }

  /** Lets the login page check a role pick against a phone number before sending an OTP. No account yet is eligible, except for the staff role. */
  @Get('auth/check-role')
  @Public()
  checkRoleEligibility(
    @Query() query: CheckRoleEligibilityQueryDto,
  ): Promise<{ ok: boolean; suggestedRole?: LoginRole }> {
    return this.authService.checkRoleEligibility(query.phone, query.role);
  }
}
