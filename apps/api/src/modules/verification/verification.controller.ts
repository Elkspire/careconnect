import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import { UploadVerificationDocumentDto } from './verification.dto';
import {
  VerificationService,
  type UploadedFile as VerificationUploadedFile,
} from './verification.service';

@Controller('practitioners/me/verification-documents')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UploadVerificationDocumentDto,
    @UploadedFile() file: VerificationUploadedFile,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.verificationService.uploadDocument(user.id, body, file);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.listMine(user.id);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.verificationService.deleteDocument(user.id, id);
  }
}
