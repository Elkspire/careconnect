import { Module } from '@nestjs/common';
import { MedicalSummaryModule } from '../medical-summary/medical-summary.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [MedicalSummaryModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
