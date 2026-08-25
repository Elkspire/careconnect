import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { AuditLogService } from './audit.service';

@Controller('audit-log')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /** A courtesy/debug view of the caller's own actions — mirrors the audit_log_select_own RLS policy. */
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.auditLogService.listForActor(user.id);
  }
}
