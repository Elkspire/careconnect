import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { NoShowService } from './no-show.service';

@Module({
  imports: [PatientsModule],
  controllers: [BookingController],
  providers: [BookingService, NoShowService],
  exports: [NoShowService],
})
export class BookingModule {}
