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

  @Get('practitioners/:id/verification-documents')
  listPractitionerDocuments(@Param('id') id: string) {
    return this.adminService.listPractitionerDocuments(id);
  }

  @Get('verification-documents/:id/signed-url')
  getDocumentSignedUrl(@Param('id') id: string) {
    return this.adminService.getDocumentSignedUrl(id);
  }

  @Get('reviews/reported')
  listReportedReviews() {
    return this.adminService.listReportedReviews();
  }

  @Get('reviews/hidden')
  listHiddenReviews() {
    return this.adminService.listHiddenReviews();
  }

  @Post('reviews/:id/hide')
  hideReview(@Param('id') id: string) {
    return this.adminService.hideReview(id);
  }

  @Post('reviews/:id/unhide')
  unhideReview(@Param('id') id: string) {
    return this.adminService.unhideReview(id);
  }
}
