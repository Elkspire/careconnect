import {
  expoPushRegisterSchema,
  expoPushUnregisterSchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class PushSubscribeDto extends createZodDto(pushSubscribeSchema) {}
export class PushUnsubscribeDto extends createZodDto(pushUnsubscribeSchema) {}
export class ExpoPushRegisterDto extends createZodDto(
  expoPushRegisterSchema,
) {}
export class ExpoPushUnregisterDto extends createZodDto(
  expoPushUnregisterSchema,
) {}
