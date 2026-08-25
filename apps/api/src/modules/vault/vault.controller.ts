import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { ListVaultRecordsQueryDto, UploadVaultRecordDto } from './vault.dto';
import {
  VaultService,
  type UploadedFile as VaultUploadedFile,
} from './vault.service';

@Controller('vault/records')
@UseInterceptors(AuditLogInterceptor)
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post()
  // Matches apps/web's next.config.ts serverActions.bodySizeLimit — keep
  // both in sync. Without an explicit limit here, Multer's default is
  // effectively unbounded.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Audit('create', 'patient_record', 'patient')
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UploadVaultRecordDto,
    @UploadedFile() file: VaultUploadedFile,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.vaultService.uploadRecord(user.id, body, file);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListVaultRecordsQueryDto,
  ) {
    return this.vaultService.listRecords(user.id, query);
  }

  @Get(':id/signed-url')
  @Audit('view', 'patient_record', 'patient')
  getSignedUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.vaultService.getSignedUrl(user.id, id);
  }

  @Delete(':id')
  @Audit('delete', 'patient_record', 'patient')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.vaultService.deleteRecord(user.id, id);
  }
}
