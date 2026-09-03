import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { ReportReviewDto, SubmitReviewDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller('practitioners/:practitionerId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Public — the directory/profile pages show ratings to signed-out visitors too. */
  @Get()
  @Public()
  async list(@Param('practitionerId') practitionerId: string) {
    const [summary, reviews] = await Promise.all([
      this.reviewsService.getSummary(practitionerId),
      this.reviewsService.list(practitionerId),
    ]);
    return { summary, reviews };
  }

  @Post()
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('practitionerId') practitionerId: string,
    @Body() body: SubmitReviewDto,
  ) {
    return this.reviewsService.submit(user.id, practitionerId, body);
  }

  /**
   * A practitioner reporting a review of themselves — ignores the URL's
   * :practitionerId in favor of the caller's own id, same as `submit`
   * above does with patientId, so nobody can report on another
   * practitioner's behalf by editing the URL.
   */
  @Post(':reviewId/report')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() body: ReportReviewDto,
  ) {
    return this.reviewsService.report(user.id, reviewId, body);
  }
}
