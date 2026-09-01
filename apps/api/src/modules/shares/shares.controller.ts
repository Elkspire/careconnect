import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { CreateShareDto } from './shares.dto';
import { SharesService } from './shares.service';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateShareDto) {
    return this.sharesService.create(user.id, body);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.sharesService.listMine(user.id);
  }

  @Post(':shareId/revoke')
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('shareId') shareId: string,
  ) {
    return this.sharesService.revoke(user.id, shareId);
  }

  /** No auth — this is the link a doctor opens without a CareConnect account. */
  @Public()
  @Get('view/:token')
  viewShared(@Param('token') token: string) {
    return this.sharesService.getSharedBundle(token);
  }
}
