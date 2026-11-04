import { Module } from '@nestjs/common';
import { VaultModule } from '../vault/vault.module';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [VaultModule],
  controllers: [AuthController],
  providers: [AuthService, AccountService],
})
export class AuthModule {}
