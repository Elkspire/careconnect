import { Module } from '@nestjs/common';
import { ClinicalController } from './clinical.controller';
import { ClinicalService } from './clinical.service';
import { PatientClinicalController } from './patient-clinical.controller';

@Module({
  controllers: [ClinicalController, PatientClinicalController],
  providers: [ClinicalService],
})
export class ClinicalModule {}
