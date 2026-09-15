import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './common/database/database.module';
import { ClinicRoleGuard } from './common/guards/clinic-role.guard';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { StorageModule } from './common/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { ClinicModule } from './modules/clinic/clinic.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PractitionersModule } from './modules/practitioners/practitioners.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SharesModule } from './modules/shares/shares.module';
import { VaultModule } from './modules/vault/vault.module';
import { VerificationModule } from './modules/verification/verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    StorageModule,
    AuditModule,
    AuthModule,
    DirectoryModule,
    ReviewsModule,
    PatientsModule,
    PractitionersModule,
    BookingModule,
    ClinicModule,
    ClinicalModule,
    VaultModule,
    SharesModule,
    VerificationModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: SupabaseAuthGuard populates request.user before
    // ClinicRoleGuard needs it.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: ClinicRoleGuard },
  ],
})
export class AppModule {}
