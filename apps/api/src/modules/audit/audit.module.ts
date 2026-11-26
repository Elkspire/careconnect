import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditLogService } from './audit.service';

/** Global so AuditLogInterceptor (used from ClinicModule, ClinicalModule and VaultModule) can inject AuditLogService without each importing AuditModule. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
