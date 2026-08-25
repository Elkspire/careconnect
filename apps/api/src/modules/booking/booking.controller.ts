import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import {
  AvailabilityQueryDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  JoinWaitlistDto,
  RescheduleAppointmentDto,
} from './booking.dto';
import { BookingService } from './booking.service';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /** Public so a patient can preview live availability before signing in. */
  @Public()
  @Get('availability')
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.bookingService.getAvailability(query);
  }

  @Post('appointments')
  createAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateAppointmentDto,
  ) {
    return this.bookingService.createAppointment(user.id, body);
  }

  @Post('appointments/reschedule')
  rescheduleAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RescheduleAppointmentDto,
  ) {
    return this.bookingService.rescheduleAppointment(user.id, body);
  }

  @Post('appointments/cancel')
  cancelAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CancelAppointmentDto,
  ) {
    return this.bookingService.cancelAppointment(user.id, body);
  }

  @Get('appointments')
  listMyAppointments(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.listMyAppointments(user.id);
  }

  @Post('waitlist')
  joinWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: JoinWaitlistDto,
  ) {
    return this.bookingService.joinWaitlist(user.id, body);
  }

  @Get('waitlist')
  listMyWaitlist(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.listMyWaitlistEntries(user.id);
  }
}
