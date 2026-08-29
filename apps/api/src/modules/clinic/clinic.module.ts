import { Module } from '@nestjs/common';
import { VaultModule } from '../vault/vault.module';
import { ClinicController } from './clinic.controller';
import { ClinicService } from './clinic.service';

@Module({
  imports: [VaultModule],
  controllers: [ClinicController],
  providers: [ClinicService],
})
export class ClinicModule {}
