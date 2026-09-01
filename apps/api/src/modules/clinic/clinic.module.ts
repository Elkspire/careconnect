import { Module } from '@nestjs/common';
import { MedicalSummaryModule } from '../medical-summary/medical-summary.module';
import { VaultModule } from '../vault/vault.module';
import { ClinicController } from './clinic.controller';
import { ClinicService } from './clinic.service';

@Module({
  imports: [VaultModule, MedicalSummaryModule],
  controllers: [ClinicController],
  providers: [ClinicService],
})
export class ClinicModule {}
