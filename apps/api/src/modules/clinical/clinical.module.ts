import { Module } from '@nestjs/common';
import { MedicalSummaryModule } from '../medical-summary/medical-summary.module';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';
import { PatientClinicalController } from './patient-clinical.controller';

@Module({
  imports: [MedicalSummaryModule],
  controllers: [ClinicalController, PatientClinicalController],
  providers: [ClinicalService],
})
export class ClinicalModule {}
