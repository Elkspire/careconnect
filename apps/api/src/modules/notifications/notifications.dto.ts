import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from '@careconnect/validation';
import { createZodDto } from 'nestjs-zod';

export class PushSubscribeDto extends createZodDto(pushSubscribeSchema) {}
export class PushUnsubscribeDto extends createZodDto(pushUnsubscribeSchema) {}
