import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { AuthService, type MeResponse } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Profile-bootstrap: tells the web/mobile client whether this session is a patient, a practitioner, and/or clinic staff, and where to route/onboard them. */
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    const profile = await this.authService.getMe(user.id);
    return { id: user.id, phone: user.phone, email: user.email, ...profile };
  }
}
