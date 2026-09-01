import { Module } from '@nestjs/common';
import { ClinicalModule } from '../clinical/clinical.module';
import { MedicalSummaryModule } from '../medical-summary/medical-summary.module';
import { VaultModule } from '../vault/vault.module';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [ClinicalModule, MedicalSummaryModule, VaultModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}
