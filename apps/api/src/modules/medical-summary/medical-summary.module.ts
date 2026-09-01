import { Module } from '@nestjs/common';
import { MedicalSummaryService } from './medical-summary.service';

@Module({
  providers: [MedicalSummaryService],
  exports: [MedicalSummaryService],
})
export class MedicalSummaryModule {}
