import { Body, Controller, Delete, Get, Inject, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../common/database/database.module';
import {
  expoPushTokens,
  notificationLog,
  pushSubscriptions,
} from '../../common/database/schema';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../common/guards/supabase-auth.guard';
import {
  ExpoPushRegisterDto,
  ExpoPushUnregisterDto,
  PushSubscribeDto,
  PushUnsubscribeDto,
} from './notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  /** The in-app feed: this caller's own in_app-channel notification_log rows. */
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.db
      .select()
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.recipientUserId, user.id),
          eq(notificationLog.channel, 'in_app'),
        ),
      )
      .orderBy(desc(notificationLog.createdAt))
      .limit(50);
  }

  /** Public — the frontend needs this to construct a PushManager.subscribe() call. */
  @Get('push/vapid-public-key')
  @Public()
  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.config.getOrThrow<string>('VAPID_PUBLIC_KEY') };
  }

  @Post('push/subscriptions')
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PushSubscribeDto,
  ): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({
        userId: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      })
      // A browser can re-subscribe with the same endpoint (e.g. after
      // clearing permission and re-granting it) — keep the latest keys
      // rather than erroring on the unique constraint.
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userId: user.id,
        },
      });
  }

  @Delete('push/subscriptions')
  async unsubscribe(@Body() body: PushUnsubscribeDto): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, body.endpoint));
  }

  /** The mobile app's equivalent of push/subscriptions — see ExpoPushAdapter. */
  @Post('push/expo-tokens')
  async registerExpoToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ExpoPushRegisterDto,
  ): Promise<void> {
    await this.db
      .insert(expoPushTokens)
      .values({ userId: user.id, token: body.token })
      // The same device can re-register (app reinstall, token refresh on
      // sign-out/in as a different user) — keep it pointed at whoever holds
      // it now rather than erroring on the unique constraint.
      .onConflictDoUpdate({
        target: expoPushTokens.token,
        set: { userId: user.id },
      });
  }

  @Delete('push/expo-tokens')
  async unregisterExpoToken(@Body() body: ExpoPushUnregisterDto): Promise<void> {
    await this.db
      .delete(expoPushTokens)
      .where(eq(expoPushTokens.token, body.token));
  }
}
