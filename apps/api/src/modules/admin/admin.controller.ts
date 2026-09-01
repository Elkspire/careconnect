import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { RejectPractitionerDto } from './admin.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Defaults to unverified+pending (the review queue); pass ?status=verified to see the rest. */
  @Get('practitioners')
  listPractitioners(
    @Query('status') status?: 'unverified' | 'pending' | 'verified',
  ) {
    return this.adminService.listPractitioners(status);
  }

  @Post('practitioners/:id/verify')
  verify(@Param('id') id: string) {
    return this.adminService.verify(id);
  }

  @Post('practitioners/:id/reject')
  reject(@Param('id') id: string, @Body() body: RejectPractitionerDto) {
    return this.adminService.reject(id, body.reason);
  }
}
