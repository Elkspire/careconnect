import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { RegisterPractitionerDto } from './practitioners.dto';
import { PractitionersService } from './practitioners.service';

@Controller('practitioners/me')
export class PractitionersController {
  constructor(private readonly practitionersService: PractitionersService) {}

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterPractitionerDto,
  ) {
    return this.practitionersService.register(user.id, body);
  }
}
